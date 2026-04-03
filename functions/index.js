const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onRequest} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {MercadoPagoConfig, Payment, Preference} = require("mercadopago");
const cors = require("cors")({origin: true}); 
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();

// 1. CONFIGURAÇÃO DO MERCADO PAGO
const accessToken = "TEST-7836166911445116-031722-d0c5e5953a3c421c2de9067cfad9f2f4-230652618";
const client = new MercadoPagoConfig({accessToken: accessToken});

// 2. MOTOR DE NOTIFICAÇÕES PUSH
exports.enviarPushNotificationGenerica = onDocumentCreated(
  "users/{userId}/notifications/{notificationId}",
  async (event) => {
    if (!event.data) return;
    const novaNotificacao = event.data.data();
    const userId = event.params.userId;
    const userDoc = await admin.firestore()
      .collection("users").doc(userId).get();
    if (!userDoc.exists) return;
    const tokens = userDoc.data().fcmTokens;
    if (!tokens || tokens.length === 0) return;

    const payload = {
      notification: {
        title: novaNotificacao.title || "Nova Notificação",
        body: novaNotificacao.body || "Nova mensagem no Okan.",
      },
      data: {
        type: String(novaNotificacao.type || "geral"),
        actionId: String(novaNotificacao.actionId || ""),
      },
      android: {
        notification: {channelId: "high_importance_channel", sound: "default"},
      },
      tokens: tokens,
    };
    try {
      await admin.messaging().sendEachForMulticast(payload);
    } catch (e) {
      console.error("Erro ao enviar Push:", e);
    }
  }
);

// 3A. GERAR PIX (V2) - APP
exports.criarPagamentoPix = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Precisa de estar autenticado.");
  }
  const {planoNome, preco} = request.data;
  const uid = request.auth.uid;
  const email = request.auth.token.email || "email@teste.com";

  try {
    const payment = new Payment(client);
    const result = await payment.create({
      body: {
        transaction_amount: preco,
        description: planoNome,
        payment_method_id: "pix",
        payer: {email: email},
        external_reference: uid,
        notification_url: "https://webhookmercadopago-pxytyhhu5q-uc.a.run.app",
      },
    });
    return {
      id: result.id,
      qr_code: result.point_of_interaction.transaction_data.qr_code,
      qr_code_base64:
        result.point_of_interaction.transaction_data.qr_code_base64,
    };
  } catch (error) {
    console.error(error);
    throw new HttpsError("internal", "Erro ao gerar pagamento PIX.");
  }
});

// 3B. PAGAMENTO COM CARTÃO DE CRÉDITO (V2) - APP
exports.criarPagamentoCartao = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Precisa de estar autenticado.");
  }
  const {
    planoNome, preco, tokenCartao, parcelas, 
    metodoPagamentoId, emailPagador, tipoDoc, numeroDoc,
  } = request.data;
  const uid = request.auth.uid;

  try {
    const payment = new Payment(client);
    const result = await payment.create({
      body: {
        transaction_amount: preco,
        token: tokenCartao,
        description: planoNome,
        installments: parcelas,
        payment_method_id: metodoPagamentoId,
        payer: {
          email: emailPagador,
          identification: {type: tipoDoc, number: numeroDoc},
        },
        external_reference: uid,
        notification_url: "https://webhookmercadopago-pxytyhhu5q-uc.a.run.app",
      },
    });
    return {
      id: result.id,
      status: result.status,
      status_detail: result.status_detail,
    };
  } catch (error) {
    console.error(error);
    throw new HttpsError("internal", "Erro ao processar cartão.");
  }
});

// 4. WEBHOOK (V2)
exports.webhookMercadoPago = onRequest(async (req, res) => {
  const {type, data} = req.body;
  if (type === "payment") {
    try {
      const payment = new Payment(client);
      const pagamentoInfo = await payment.get({id: data.id});
      if (pagamentoInfo.status === "approved") {
        const uid = pagamentoInfo.external_reference;
        await admin.firestore().collection("users").doc(uid).update({
          isPremium: true,
          subscriptionPlan: pagamentoInfo.description,
          subscriptionDate: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      res.status(200).send("Notificação recebida");
    } catch (error) {
      console.error("Erro no Webhook:", error);
      res.status(500).send("Erro interno");
    }
  } else {
    res.status(200).send("Ignorado");
  }
});

// =========================================================================
// 5. CHECKOUT TRANSPARENTE B2B (NOVO: PAGAMENTO DIRETO NO SITE)
// =========================================================================
exports.processarPagamentoWeb = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).send({error: "Método não permitido."});

    try {
      const { quantidade, diaVencimento, emailGestor, token, payment_method_id, payer, installments, issuer_id } = req.body;

      // Cálculo Seguro do Pro-Rata no Backend
      const VALOR_MENSAL_LICENCA = 45.00;
      const VALOR_DIARIO_LICENCA = VALOR_MENSAL_LICENCA / 30;
      
      const hoje = new Date();
      const diaHoje = hoje.getDate();
      let diasRestantes = 0;

      if (diaHoje < diaVencimento) diasRestantes = diaVencimento - diaHoje;
      else if (diaHoje === diaVencimento) diasRestantes = 30;
      else diasRestantes = (30 - diaHoje) + diaVencimento;

      const valorProRataHoje = Number((diasRestantes * VALOR_DIARIO_LICENCA * quantidade).toFixed(2));

      // Debita o cartão
      const payment = new Payment(client);
      const result = await payment.create({
        body: {
          transaction_amount: valorProRataHoje,
          token: token,
          description: `Licenças Premium Okan (${quantidade}x) - Pro-Rata`,
          installments: installments,
          payment_method_id: payment_method_id,
          issuer_id: issuer_id,
          payer: {
            email: emailGestor,
            identification: payer?.identification 
          }
        }
      });

      // =========================================================
      // SALVAR DADOS PARA A COBRANÇA RECORRENTE MENSAL
      // =========================================================
      if (result.status === "approved") {
        const { Customer } = require("mercadopago");
        const customerClient = new Customer(client);
        let customerId = "";

        try {
          // 1. Tenta criar um Cliente no "Cofre" do Mercado Pago
          const customerResult = await customerClient.create({ body: { email: emailGestor } });
          customerId = customerResult.id;
        } catch (e) {
          // 2. Se o cliente já existir no MP, nós apenas buscamos o ID dele
          const search = await customerClient.search({ qs: { email: emailGestor } });
          if (search.results && search.results.length > 0) {
            customerId = search.results[0].id;
          }
        }

        // 3. Salva tudo no Firestore da Academia
        const academiaQuery = await admin.firestore().collection("academias").where("emailGestor", "==", emailGestor).get();
        if (!academiaQuery.empty) {
          const academiaId = academiaQuery.docs[0].id;
          await admin.firestore().collection("academias").doc(academiaId).update({
            customerId: customerId, // Salva o ID do Cofre
            metodoPagamentoId: payment_method_id, // Salva se foi Visa, Master, etc
            licencasTotais: quantidade,
            diaVencimento: diaVencimento,
            statusAssinatura: "Ativa",
            cancelamentoAgendado: false
          });
        }
      }

      return res.status(200).json({ 
        status: result.status, 
        status_detail: result.status_detail,
        id: result.id
      });

    } catch (error) {
      console.error("Erro no Checkout Transparente:", error);
      return res.status(500).json({error: "Falha ao debitar o cartão."});
    }
  });
});

// =========================================================================
// 6. ROBÔ MENSAL DE ASSINATURAS (CRON JOB)
// =========================================================================
exports.motorDeCobrancaMensal = onSchedule("every day 01:00", async (event) => {
  console.log("Iniciando rotina de cobrança diária...");
  
  const hoje = new Date();
  const diaAtual = hoje.getDate(); // Ex: 10

  try {
    // 1. Busca todas as academias ativas no banco de dados
    const academiasSnapshot = await admin.firestore()
      .collection("academias")
      .where("statusAssinatura", "in", ["Ativa", "Pendente"])
      .get();

    for (const doc of academiasSnapshot.docs) {
      const academia = doc.data();
      const idAcademia = doc.id;

      // 2. É o dia de vencimento desta academia?
      if (academia.diaVencimento === diaAtual) {
        
        // Verifica se a academia pediu para cancelar durante o mês
        if (academia.cancelamentoAgendado === true) {
           await admin.firestore().collection("academias").doc(idAcademia).update({
             statusAssinatura: "Cancelada",
             licencasTotais: 0 // Revoga os acessos
           });
           console.log(`Academia ${academia.nome} cancelada com sucesso.`);
           continue; // Pula para a próxima academia
        }

        // 3. Calcula o valor da fatura do mês
        const qtdLicencas = academia.licencasTotais || 0;
        const valorFatura = qtdLicencas * 45.00;

        console.log(`Gerando cobrança de R$ ${valorFatura} para a academia ${academia.nome}...`);

        try {
          const payment = new Payment(client);
          const transacao = await payment.create({
            body: {
              transaction_amount: valorFatura,
              description: `Okan Premium - Mensalidade (${qtdLicencas} Licenças)`,
              payment_method_id: academia.metodoPagamentoId || "visa", // Usa a bandeira do cartão salvo
              payer: {
                type: "customer",
                id: academia.customerId // A MÁGICA ESTÁ AQUI: Cobra direto no cofre do MP
              }
            }
          });

          // Se o Mercado Pago aprovar o débito no cartão
          if (transacao.status === "approved") {
            await admin.firestore().collection("academias").doc(idAcademia).update({
              statusAssinatura: "Ativa",
              ultimaFaturaGerada: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`Sucesso: Fatura paga para ${academia.nome}.`);
          } else {
            // Se o cartão for recusado (falta de limite, cancelado, etc)
            await admin.firestore().collection("academias").doc(idAcademia).update({
              statusAssinatura: "Aguardando Pagamento"
            });
            console.log(`Recusado: Pagamento falhou para ${academia.nome}.`);
          }
        } catch (e) {
          console.error(`Erro crítico ao faturar ${academia.nome}:`, e);
          await admin.firestore().collection("academias").doc(idAcademia).update({
            statusAssinatura: "Aguardando Pagamento"
          });
        }

      } 

      // 4. Regra de Bloqueio (Inadimplência)
      // Se passou 3 dias do vencimento e o status continua "Aguardando Pagamento"
      else if (academia.statusAssinatura === "Aguardando Pagamento") {
         let diasAtraso = diaAtual - academia.diaVencimento;
         // Ajuste simples para virada de mês (ex: venceu dia 28, hoje é dia 2)
         if (diasAtraso < 0) diasAtraso += 30; 

         if (diasAtraso >= 3) {
            await admin.firestore().collection("academias").doc(idAcademia).update({
              statusAssinatura: "Inadimplente",
              licencasBloqueadas: true // Os professores perdem o acesso ao app
            });
            console.log(`Academia ${academia.nome} BLOQUEADA por falta de pagamento.`);
         }
      }
    }
  } catch (error) {
    console.error("Erro na rotina de cobrança:", error);
  }
});
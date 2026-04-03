const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onRequest} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {MercadoPagoConfig, Payment, Preference} = require("mercadopago");
const cors = require("cors")({origin: true}); 

admin.initializeApp();

// 1. CONFIGURAÇÃO DO MERCADO PAGO
const accessToken = "TEST-7836166911445116-031722-d0c5e5953a3c421c2de9067cfad9f2f4-230652618";
const client = new MercadoPagoConfig({accessToken: accessToken});

// 2. MOTOR DE NOTIFICAÇÕES PUSH (DO APP)
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
        type: novaNotificacao.type || "general",
        actionId: novaNotificacao.actionId || "",
      },
    };

    try {
      await admin.messaging().sendToDevice(tokens, payload);
    } catch (error) {
      console.error("Erro ao enviar push:", error);
    }
  }
);

// 3. PAGAMENTO DIRETO NO CARTÃO (DO APP)
exports.processarPagamentoCartao = onCall(async (request) => {
  const {
    preco, tokenCartao, planoNome, parcelas, emailPagador,
    tipoDoc, numeroDoc, metodoPagamentoId,
  } = request.data;
  const uid = request.auth?.uid;

  if (!uid) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

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

// 4. WEBHOOK (V2) (DO APP)
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
    res.status(200).send("Evento ignorado");
  }
});

// =========================================================================
// 5. CHECKOUT B2B PRO-RATA (NOVO: PARA O PAINEL WEB DAS ACADEMIAS)
// =========================================================================
exports.gerarCheckoutLicencas = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send({error: "Método não permitido."});
    }

    try {
      const {quantidade, diaVencimento, emailGestor} = req.body;

      // Cálculo Seguro do Pro-Rata no Backend
      const VALOR_MENSAL_LICENCA = 45.00;
      const VALOR_DIARIO_LICENCA = VALOR_MENSAL_LICENCA / 30;
      
      const hoje = new Date();
      const diaHoje = hoje.getDate();
      let diasRestantes = 0;

      if (diaHoje < diaVencimento) {
        diasRestantes = diaVencimento - diaHoje;
      } else if (diaHoje === diaVencimento) {
        diasRestantes = 30;
      } else {
        diasRestantes = (30 - diaHoje) + diaVencimento;
      }

      const valorProRataHoje = Number((diasRestantes * VALOR_DIARIO_LICENCA * quantidade).toFixed(2));

      // Gera a preferência de pagamento (Link do Checkout)
      const preference = new Preference(client);
      const result = await preference.create({
        body: {
          items: [
            {
              id: `LIC-OKAN-${quantidade}`,
              title: `Licenças Premium Okan (${quantidade}x) - Pro-Rata`,
              description: `Vencimento todo dia ${diaVencimento}.`,
              quantity: 1,
              unit_price: valorProRataHoje,
              currency_id: "BRL",
            }
          ],
          payer: {
            email: emailGestor,
          },
          back_urls: {
            success: "app-academia-2914d.web.app/dashboard.html?pagamento=sucesso",
            failure: "app-academia-2914d.web.app/dashboard.html?pagamento=falha",
            pending: "app-academia-2914d.web.app/dashboard.html?pagamento=pendente"
          },
          auto_return: "approved",
        }
      });

      // Retorna o link Sandbox (já que você está usando o TEST Token)
      return res.status(200).json({ 
        linkPagamento: result.sandbox_init_point || result.init_point, 
        valorCobrado: valorProRataHoje 
      });

    } catch (error) {
      console.error("Erro ao gerar checkout MP:", error);
      return res.status(500).json({error: "Falha interna ao gerar pagamento."});
    }
  });
});

// =========================================================================
// 6. CHECKOUT TRANSPARENTE (PAGAMENTO DIRETO NO SITE)
// =========================================================================
exports.processarPagamentoWeb = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).send({error: "Método não permitido."});

    try {
      // O Brick do Mercado Pago envia o token do cartão e os dados do pagador
      const { quantidade, diaVencimento, emailGestor, token, payment_method_id, payer, installments, issuer_id } = req.body;

      // 1. Recalculamos o Pro-Rata no servidor por segurança (nunca confie no front-end)
      const VALOR_MENSAL_LICENCA = 45.00;
      const VALOR_DIARIO_LICENCA = VALOR_MENSAL_LICENCA / 30;
      const hoje = new Date();
      const diaHoje = hoje.getDate();
      let diasRestantes = 0;

      if (diaHoje < diaVencimento) diasRestantes = diaVencimento - diaHoje;
      else if (diaHoje === diaVencimento) diasRestantes = 30;
      else diasRestantes = (30 - diaHoje) + diaVencimento;

      const valorProRataHoje = Number((diasRestantes * VALOR_DIARIO_LICENCA * quantidade).toFixed(2));

      // 2. Chamamos a API de Pagamentos para debitar o cartão na hora
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
            email: emailGestor, // Forçamos o e-mail logado no Okan
            identification: payer?.identification // CPF/CNPJ do titular do cartão
          }
        }
      });

      // Retornamos o status do cartão (Aprovado, Recusado, etc)
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
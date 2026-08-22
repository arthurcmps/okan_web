const fs = require("fs");

const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");

const {
  doc,
  collection,
  setDoc,
  updateDoc,
  writeBatch,
  getDoc,
  deleteField,
} = require("firebase/firestore");

const {
  before,
  after,
  beforeEach,
  test,
} = require("node:test");

const PROJECT_ID = "app-academia-2914d";

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // Aluno usado nos testes
    await setDoc(doc(db, "users", "aluno-1"), {
      uid: "aluno-1",
      name: "Aluno Teste",
      email: "aluno@okan.test",
      tipo: "aluno",
    });

    // Personal realmente vinculado ao aluno
    await setDoc(doc(db, "users", "personal-1"), {
      uid: "personal-1",
      name: "Personal Vinculado",
      email: "personal1@okan.test",
      tipo: "personal",
    });

    // Outro personal, sem vinculo com o aluno
    await setDoc(doc(db, "users", "personal-2"), {
      uid: "personal-2",
      name: "Personal Nao Vinculado",
      email: "personal2@okan.test",
      tipo: "personal",
    });

    // Vinculo valido:
    // aluno-1 pertence ao personal-1
    await updateDoc(doc(db, "users", "aluno-1"), {
    personalId: "personal-1",
    });
        // Gestor usado nos testes de seguranca da academia
    await setDoc(doc(db, "users", "gestor-owner"), {
      uid: "gestor-owner",
      name: "Gestor Proprietario",
      email: "owner@okan.test",
      role: "gym_admin",
      academiaId: "academia-owner",
    });

    // Academia pertencente ao gestor acima
    await setDoc(doc(db, "academias", "academia-owner"), {
      nome: "Academia Owner",
      emailGestor: "owner@okan.test",
      ownerUid: "gestor-owner",
      cnpj: "00.000.000/0001-00",
      cep: "20000-000",
      endereco: "Rua de Teste, 100",
      bairro: "Centro",
      uf: "RJ",
      telefoneResponsavel: "(21) 99999-9999",
      licencasTotais: 5,
      licencasUsadas: 2,
      cancelamentoAgendado: false,
    });

        // Convite pendente usado nos testes de relacionamento
    await setDoc(doc(db, "invites", "invite-1"), {
      fromPersonalId: "personal-1",
      personalId: "personal-1",
      personalName: "Personal Vinculado",
      toStudentEmail: "aluno@okan.test",
      studentUid: "aluno-1",
      status: "pending",
    });

        // Historico de treino usado nos testes de autorizacao
    await setDoc(doc(db, "workout_history", "history-1"), {
      studentId: "aluno-1",
      workoutName: "Treino A",
      completed: false,
    });

        await setDoc(doc(db, "workouts", "workout-personal-2"), {
      personalId: "personal-2",
      nome: "Treino do Personal 2",
    });

        await setDoc(
      doc(db, "workout_templates", "template-personal-2"),
      {
        personalId: "personal-2",
        nome: "Template do Personal 2",
      },
    );

        // Chat existente usado nos testes de autorizacao
    await setDoc(doc(db, "chats", "chat-1"), {
      users: ["aluno-1", "personal-1"],
      lastMessage: "Mensagem inicial",
    });

    await setDoc(
      doc(db, "chats", "chat-1", "messages", "message-1"),
      {
        senderId: "aluno-1",
        text: "Mensagem de teste",
      },
    );

    await setDoc(doc(db, "friendships", "friendship-1"), {
      requesterId: "aluno-1",
      receiverId: "personal-1",
      status: "pending",
    });

    await setDoc(doc(db, "challenges", "challenge-1"), {
      creatorId: "aluno-1",
      metric: "constancy",
      durationDays: 30,
      participantIds: ["aluno-1", "personal-1"],
      participants: {
        "aluno-1": {
          name: "Aluno",
          status: "accepted",
          startValue: 0,
        },
        "personal-1": {
          name: "Personal 1",
          status: "pending",
        },
      },
      imagensApagadas: false,
    });

    await setDoc(
      doc(db, "challenges", "challenge-1", "posts", "post-1"),
      {
        authorId: "aluno-1",
        authorName: "Aluno",
        text: "Primeiro post",
        reactions: {},
        commentsCount: 0,
      },
    );

    await setDoc(doc(db, "tarefas", "tarefa-1"), {
  userId: "aluno-1",
  titulo: "Treinar",
  concluida: false,
});

    await setDoc(
      doc(
        db,
        "academias",
        "academia-owner",
        "professores",
        "professor-1",
      ),
      {
        nome: "Professor Teste",
        email: "professor@okan.test",
      },
    );

    await setDoc(doc(db, "beta_feedback", "feedback-1"), {
      userId: "aluno-1",
      mensagem: "Feedback de teste",
    });
  });
});

test(
  "usuario nao pode transformar a propria conta em super_admin",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    const userRef = doc(db, "users", "aluno-1");

    await assertFails(
      updateDoc(userRef, {
        role: "super_admin",
      }),
    );
  },
);

test(
  "usuario nao pode ativar isPremium manualmente",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    const userRef = doc(db, "users", "aluno-1");

    await assertFails(
      updateDoc(userRef, {
        isPremium: true,
      }),
    );
  },
);

test(
  "usuario pode alterar um campo comum do proprio perfil",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    const userRef = doc(db, "users", "aluno-1");

    await assertSucceeds(
      updateDoc(userRef, {
        name: "Aluno Atualizado",
      }),
    );
  },
);

test(
  "personal vinculado nao pode mais gravar teacherNotes no documento publico do aluno",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    const studentRef = doc(
      db,
      "users",
      "aluno-1",
    );

    await assertFails(
      updateDoc(studentRef, {
        teacherNotes:
          "Tentativa de usar campo legado",
      }),
    );
  },
);

test(
  "personal nao vinculado nao pode atualizar teacherNotes do aluno",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-2", {
        email: "personal2@okan.test",
      })
      .firestore();

    const studentRef = doc(db, "users", "aluno-1");

    await assertFails(
      updateDoc(studentRef, {
        teacherNotes: "Tentativa indevida",
      }),
    );
  },
);

test(
  "novo usuario nao pode se cadastrar diretamente como gym_admin",
  async () => {
    const db = testEnv
      .authenticatedContext("novo-gestor", {
        email: "gestor@okan.test",
      })
      .firestore();

    const userRef = doc(db, "users", "novo-gestor");

    await assertFails(
      setDoc(userRef, {
        uid: "novo-gestor",
        name: "Gestor Teste",
        email: "gestor@okan.test",
        role: "gym_admin",
      }),
    );
  },
);

test(
  "cadastro legitimo pode criar academia e gym_admin no mesmo lote",
  async () => {
    const db = testEnv
      .authenticatedContext("gestor-1", {
        email: "gestor@okan.test",
      })
      .firestore();

    const academiaRef = doc(collection(db, "academias"));
    const userRef = doc(db, "users", "gestor-1");

    const batch = writeBatch(db);

    batch.set(academiaRef, {
      nome: "Academia Teste",
      emailGestor: "gestor@okan.test",
      ownerUid: "gestor-1",
      licencasTotais: 0,
      licencasUsadas: 0,
    });

    batch.set(userRef, {
      uid: "gestor-1",
      name: "Gestor Teste",
      email: "gestor@okan.test",
      role: "gym_admin",
      academiaId: academiaRef.id,
    });

    await assertSucceeds(batch.commit());
  },
);

test(
  "gestor pode alterar dados cadastrais da propria academia",
  async () => {
    const db = testEnv
      .authenticatedContext("gestor-owner", {
        email: "owner@okan.test",
      })
      .firestore();

    const academiaRef = doc(
      db,
      "academias",
      "academia-owner",
    );

    await assertSucceeds(
      updateDoc(academiaRef, {
        nome: "Academia Owner Atualizada",
      }),
    );
  },
);

test(
  "gestor nao pode alterar licencasTotais manualmente",
  async () => {
    const db = testEnv
      .authenticatedContext("gestor-owner", {
        email: "owner@okan.test",
      })
      .firestore();

    const academiaRef = doc(
      db,
      "academias",
      "academia-owner",
    );

    await assertFails(
      updateDoc(academiaRef, {
        licencasTotais: 100,
      }),
    );
  },
);

test(
  "gestor pode incrementar licencasUsadas em uma unidade",
  async () => {
    const db = testEnv
      .authenticatedContext("gestor-owner", {
        email: "owner@okan.test",
      })
      .firestore();

    const academiaRef = doc(
      db,
      "academias",
      "academia-owner",
    );

    await assertSucceeds(
      updateDoc(academiaRef, {
        licencasUsadas: 3,
      }),
    );
  },
);

test(
  "gestor nao pode alterar licencasUsadas em mais de uma unidade",
  async () => {
    const db = testEnv
      .authenticatedContext("gestor-owner", {
        email: "owner@okan.test",
      })
      .firestore();

    const academiaRef = doc(
      db,
      "academias",
      "academia-owner",
    );

    await assertFails(
      updateDoc(academiaRef, {
        licencasUsadas: 4,
      }),
    );
  },
);

test(
  "gestor pode agendar o cancelamento da propria academia",
  async () => {
    const db = testEnv
      .authenticatedContext("gestor-owner", {
        email: "owner@okan.test",
      })
      .firestore();

    const academiaRef = doc(
      db,
      "academias",
      "academia-owner",
    );

    await assertSucceeds(
      updateDoc(academiaRef, {
        cancelamentoAgendado: true,
      }),
    );
  },
);

test(
  "gestor nao pode reativar assinatura manualmente",
  async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const dbAdmin = context.firestore();

      await updateDoc(
        doc(dbAdmin, "academias", "academia-owner"),
        {
          cancelamentoAgendado: true,
        },
      );
    });

    const db = testEnv
      .authenticatedContext("gestor-owner", {
        email: "owner@okan.test",
      })
      .firestore();

    const academiaRef = doc(
      db,
      "academias",
      "academia-owner",
    );

    await assertFails(
      updateDoc(academiaRef, {
        cancelamentoAgendado: false,
      }),
    );
  },
);

test(
  "personal nao vinculado nao pode criar anamnese de outro aluno",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-2", {
        email: "personal2@okan.test",
      })
      .firestore();

    const anamneseRef = doc(
      db,
      "users",
      "aluno-1",
      "medical",
      "anamnese",
    );

    await assertFails(
      setDoc(anamneseRef, {
        observacoes: "Tentativa indevida",
      }),
    );
  },
);

test(
  "personal vinculado nao pode alterar anamnese do aluno",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    const anamneseRef = doc(
      db,
      "users",
      "aluno-1",
      "medical",
      "anamnese",
    );

    await assertFails(
      setDoc(anamneseRef, {
        observacoes:
          "Personal tentando alterar anamnese",
      }),
    );
  },
);

test(
  "personal nao vinculado nao pode criar avaliacao fisica de outro aluno",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-2", {
        email: "personal2@okan.test",
      })
      .firestore();

    const assessmentRef = doc(
      collection(
        db,
        "users",
        "aluno-1",
        "assessments",
      ),
    );

    await assertFails(
      setDoc(assessmentRef, {
        peso: 80,
        altura: 1.75,
      }),
    );
  },
);

test(
  "personal vinculado pode criar avaliacao fisica do aluno",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    const assessmentRef = doc(
      collection(
        db,
        "users",
        "aluno-1",
        "assessments",
      ),
    );

    await assertSucceeds(
      setDoc(assessmentRef, {
        peso: 80,
        altura: 1.75,
      }),
    );
  },
);

test(
  "usuario comum nao ganha acesso apenas por estar em personalId",
  async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const dbAdmin = context.firestore();

      await setDoc(doc(dbAdmin, "users", "usuario-comum"), {
        uid: "usuario-comum",
        name: "Usuario Comum",
        email: "comum@okan.test",
        tipo: "aluno",
      });

      await updateDoc(
        doc(dbAdmin, "users", "aluno-1"),
        {
          personalId: "usuario-comum",
        },
      );
    });

    const db = testEnv
      .authenticatedContext("usuario-comum", {
        email: "comum@okan.test",
      })
      .firestore();

    const anamneseRef = doc(
      db,
      "users",
      "aluno-1",
      "medical",
      "anamnese",
    );

    await assertFails(
      setDoc(anamneseRef, {
        observacoes: "Tentativa indevida",
      }),
    );
  },
);  

test(
  "aluno destinatario pode aceitar convite pendente",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    const inviteRef = doc(
      db,
      "invites",
      "invite-1",
    );

    await assertSucceeds(
      updateDoc(inviteRef, {
        status: "accepted",
      }),
    );
  },
);

test(
  "aluno destinatario pode recusar convite pendente",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    const inviteRef = doc(
      db,
      "invites",
      "invite-1",
    );

    await assertSucceeds(
      updateDoc(inviteRef, {
        status: "rejected",
      }),
    );
  },
);

test(
  "personal nao pode forcar aceite do proprio convite",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    const inviteRef = doc(
      db,
      "invites",
      "invite-1",
    );

    await assertFails(
      updateDoc(inviteRef, {
        status: "accepted",
      }),
    );
  },
);

test(
  "aluno nao pode alterar personalId do convite",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    const inviteRef = doc(
      db,
      "invites",
      "invite-1",
    );

    await assertFails(
      updateDoc(inviteRef, {
        personalId: "personal-2",
      }),
    );
  },
);

test(
  "usuario de fora nao pode responder convite",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-2", {
        email: "personal2@okan.test",
      })
      .firestore();

    const inviteRef = doc(
      db,
      "invites",
      "invite-1",
    );

    await assertFails(
      updateDoc(inviteRef, {
        status: "rejected",
      }),
    );
  },
);

test(
  "aluno pode atualizar o proprio historico de treino",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    const historyRef = doc(
      db,
      "workout_history",
      "history-1",
    );

    await assertSucceeds(
      updateDoc(historyRef, {
        completed: true,
      }),
    );
  },
);

test(
  "personal vinculado pode atualizar historico de treino do aluno",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    const historyRef = doc(
      db,
      "workout_history",
      "history-1",
    );

    await assertSucceeds(
      updateDoc(historyRef, {
        workoutName: "Treino A Atualizado",
      }),
    );
  },
);

test(
  "aluno nao pode transferir historico para outro studentId",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    const historyRef = doc(
      db,
      "workout_history",
      "history-1",
    );

    await assertFails(
      updateDoc(historyRef, {
        studentId: "personal-2",
      }),
    );
  },
);

test(
  "personal nao vinculado nao pode atualizar historico de treino do aluno",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-2", {
        email: "personal2@okan.test",
      })
      .firestore();

    const historyRef = doc(
      db,
      "workout_history",
      "history-1",
    );

    await assertFails(
      updateDoc(historyRef, {
        workoutName: "Tentativa indevida",
      }),
    );
  },
);

test(
  "personal vinculado pode criar ficha semanal do aluno",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    const planRef = doc(
      db,
      "workout_plans",
      "aluno-1",
    );

    await assertSucceeds(
      setDoc(planRef, {
        studentId: "aluno-1",
        title: "Ficha Semanal",
      }),
    );
  },
);

test(
  "personal nao vinculado nao pode criar ficha semanal de outro aluno",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-2", {
        email: "personal2@okan.test",
      })
      .firestore();

    const planRef = doc(
      db,
      "workout_plans",
      "aluno-1",
    );

    await assertFails(
      setDoc(planRef, {
        studentId: "aluno-1",
        title: "Tentativa indevida",
      }),
    );
  },
);

test(
  "aluno pode criar a propria ficha semanal",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    const planRef = doc(
      db,
      "workout_plans",
      "aluno-1",
    );

    await assertSucceeds(
      setDoc(planRef, {
        studentId: "aluno-1",
        title: "Minha Ficha",
      }),
    );
  },
);

test(
  "personal pode criar workout proprio",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    const workoutRef = doc(
      db,
      "workouts",
      "workout-personal-1",
    );

    await assertSucceeds(
      setDoc(workoutRef, {
        personalId: "personal-1",
        nome: "Treino Particular",
      }),
    );
  },
);

test(
  "personal nao pode criar workout em nome de outro personal",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    const workoutRef = doc(
      db,
      "workouts",
      "workout-falso",
    );

    await assertFails(
      setDoc(workoutRef, {
        personalId: "personal-2",
        nome: "Treino Indevido",
      }),
    );
  },
);

test(
  "personal nao pode editar workout de outro personal",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    const workoutRef = doc(
      db,
      "workouts",
      "workout-personal-2",
    );

    await assertFails(
      updateDoc(workoutRef, {
        nome: "Tentativa indevida",
      }),
    );
  },
);

test(
  "personal pode criar template proprio",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    const templateRef = doc(
      db,
      "workout_templates",
      "template-personal-1",
    );

    await assertSucceeds(
      setDoc(templateRef, {
        personalId: "personal-1",
        nome: "Template Particular",
      }),
    );
  },
);

test(
  "personal nao pode criar template em nome de outro personal",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    const templateRef = doc(
      db,
      "workout_templates",
      "template-falso",
    );

    await assertFails(
      setDoc(templateRef, {
        personalId: "personal-2",
        nome: "Template Indevido",
      }),
    );
  },
);

test(
  "personal nao pode editar template de outro personal",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    const templateRef = doc(
      db,
      "workout_templates",
      "template-personal-2",
    );

    await assertFails(
      updateDoc(templateRef, {
        nome: "Tentativa indevida",
      }),
    );
  },
);

test(
  "participante pode ler mensagem de chat existente",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    const messageRef = doc(
      db,
      "chats",
      "chat-1",
      "messages",
      "message-1",
    );

    await assertSucceeds(
      getDoc(messageRef),
    );
  },
);

test(
  "usuario de fora nao pode ler mensagem de chat existente",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-2", {
        email: "personal2@okan.test",
      })
      .firestore();

    const messageRef = doc(
      db,
      "chats",
      "chat-1",
      "messages",
      "message-1",
    );

    await assertFails(
      getDoc(messageRef),
    );
  },
);

test(
  "usuario autenticado pode criar chat com outro usuario",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    const chatRef = doc(
      db,
      "chats",
      "chat-novo",
    );

    await assertSucceeds(
      setDoc(chatRef, {
        users: ["aluno-1", "personal-1"],
        lastMessage: "",
      }),
    );
  },
);

test(
  "usuario nao pode criar chat sem participar dele",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    const chatRef = doc(
      db,
      "chats",
      "chat-sem-aluno",
    );

    await assertFails(
      setDoc(chatRef, {
        users: ["personal-1", "personal-2"],
        lastMessage: "",
      }),
    );
  },
);

test(
  "participante pode enviar mensagem em chat existente",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    const messageRef = doc(
      db,
      "chats",
      "chat-1",
      "messages",
      "message-nova",
    );

    await assertSucceeds(
      setDoc(messageRef, {
        senderId: "aluno-1",
        text: "Nova mensagem",
      }),
    );
  },
);

test(
  "usuario de fora nao pode enviar mensagem em chat existente",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-2", {
        email: "personal2@okan.test",
      })
      .firestore();

    const messageRef = doc(
      db,
      "chats",
      "chat-1",
      "messages",
      "message-invasora",
    );

    await assertFails(
      setDoc(messageRef, {
        senderId: "personal-2",
        text: "Tentativa indevida",
      }),
    );
  },
);

test(
  "usuario pode enviar pedido de amizade pendente",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    await assertSucceeds(
      setDoc(doc(db, "friendships", "friendship-nova"), {
        requesterId: "aluno-1",
        receiverId: "personal-1",
        status: "pending",
      }),
    );
  },
);

test(
  "usuario nao pode criar amizade ja aceita",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    await assertFails(
      setDoc(doc(db, "friendships", "friendship-falsa"), {
        requesterId: "aluno-1",
        receiverId: "personal-1",
        status: "accepted",
      }),
    );
  },
);

test(
  "destinatario pode aceitar pedido de amizade pendente",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    await assertSucceeds(
      updateDoc(
        doc(db, "friendships", "friendship-1"),
        { status: "accepted" },
      ),
    );
  },
);

test(
  "remetente nao pode forcar aceite da amizade",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    await assertFails(
      updateDoc(
        doc(db, "friendships", "friendship-1"),
        { status: "accepted" },
      ),
    );
  },
);

test(
  "usuario pode criar desafio como criador e participante",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    await assertSucceeds(
      setDoc(doc(db, "challenges", "challenge-novo"), {
        creatorId: "aluno-1",
        metric: "constancy",
        durationDays: 30,
        participantIds: ["aluno-1", "personal-1"],
        participants: {
          "aluno-1": {
            status: "accepted",
            startValue: 0,
          },
          "personal-1": {
            status: "pending",
          },
        },
        imagensApagadas: false,
      }),
    );
  },
);

test(
  "participante pode aceitar o proprio convite de duelo",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    await assertSucceeds(
      updateDoc(doc(db, "challenges", "challenge-1"), {
        "participants.personal-1.status": "accepted",
        "participants.personal-1.startValue": 0,
      }),
    );
  },
);

test(
  "participante nao pode alterar metrica do duelo",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    await assertFails(
      updateDoc(doc(db, "challenges", "challenge-1"), {
        metric: "weight",
      }),
    );
  },
);

test(
  "participante pode recusar ou sair removendo apenas a si mesmo",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    await assertSucceeds(
      updateDoc(doc(db, "challenges", "challenge-1"), {
        participantIds: ["aluno-1"],
        participants: {
          "aluno-1": {
            name: "Aluno",
            status: "accepted",
            startValue: 0,
          },
        },
      }),
    );
  },
);

test(
  "participante pode criar post no proprio duelo",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    await assertSucceeds(
      setDoc(
        doc(
          db,
          "challenges",
          "challenge-1",
          "posts",
          "post-novo",
        ),
        {
          authorId: "aluno-1",
          text: "Post legitimo",
          reactions: {},
          commentsCount: 0,
        },
      ),
    );
  },
);

test(
  "usuario de fora nao pode criar post no duelo",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-2", {
        email: "personal2@okan.test",
      })
      .firestore();

    await assertFails(
      setDoc(
        doc(
          db,
          "challenges",
          "challenge-1",
          "posts",
          "post-invasor",
        ),
        {
          authorId: "personal-2",
          text: "Post indevido",
        },
      ),
    );
  },
);

test(
  "participante nao pode reescrever texto de post alheio",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    await assertFails(
      updateDoc(
        doc(
          db,
          "challenges",
          "challenge-1",
          "posts",
          "post-1",
        ),
        {
          text: "Texto adulterado",
        },
      ),
    );
  },
);

test(
  "participante pode comentar em post do duelo",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    await assertSucceeds(
      setDoc(
        doc(
          db,
          "challenges",
          "challenge-1",
          "posts",
          "post-1",
          "comments",
          "comment-1",
        ),
        {
          authorId: "aluno-1",
          text: "Comentario legitimo",
        },
      ),
    );
  },
);

test(
  "personal pode criar convite consistente para aluno",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    await assertSucceeds(
      setDoc(doc(db, "invites", "invite-valido"), {
        personalId: "personal-1",
        fromPersonalId: "personal-1",
        toStudentEmail: "aluno@okan.test",
        studentUid: "aluno-1",
        status: "pending",
      }),
    );
  },
);

test(
  "personal nao pode criar convite com uid e email de pessoas diferentes",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    await assertFails(
      setDoc(doc(db, "invites", "invite-inconsistente"), {
        personalId: "personal-1",
        fromPersonalId: "personal-1",
        toStudentEmail: "personal2@okan.test",
        studentUid: "aluno-1",
        status: "pending",
      }),
    );
  },
);

test(
  "personal vinculado pode remover vinculo com aluno",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    await assertSucceeds(
      updateDoc(
        doc(db, "users", "aluno-1"),
        {
          personalId: deleteField(),
          personalName: deleteField(),
          inviteFromPersonalId: deleteField(),
        },
      ),
    );
  },
);

test(
  "personal nao vinculado nao pode remover vinculo do aluno",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-2", {
        email: "personal2@okan.test",
      })
      .firestore();

    await assertFails(
      updateDoc(
        doc(db, "users", "aluno-1"),
        {
          personalId: deleteField(),
          personalName: deleteField(),
          inviteFromPersonalId: deleteField(),
        },
      ),
    );
  },
);

test(
  "usuario pode criar a propria tarefa",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    await assertSucceeds(
      setDoc(doc(db, "tarefas", "tarefa-nova"), {
        userId: "aluno-1",
        titulo: "Nova tarefa",
        concluida: false,
      }),
    );
  },
);

test(
  "usuario nao pode criar tarefa para outra pessoa",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    await assertFails(
      setDoc(doc(db, "tarefas", "tarefa-falsa"), {
        userId: "personal-1",
        titulo: "Tarefa indevida",
        concluida: false,
      }),
    );
  },
);

test(
  "usuario pode atualizar a propria tarefa",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    await assertSucceeds(
      updateDoc(
        doc(db, "tarefas", "tarefa-1"),
        {
          concluida: true,
        },
      ),
    );
  },
);

test(
  "usuario nao pode transferir tarefa para outra conta",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    await assertFails(
      updateDoc(
        doc(db, "tarefas", "tarefa-1"),
        {
          userId: "personal-1",
        },
      ),
    );
  },
);

test(
  "usuario de fora nao pode ler tarefa de outro usuario",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-2", {
        email: "personal2@okan.test",
      })
      .firestore();

    await assertFails(
      getDoc(
        doc(db, "tarefas", "tarefa-1"),
      ),
    );
  },
);

test(
  "gestor pode cadastrar professor na propria academia",
  async () => {
    const db = testEnv
      .authenticatedContext("gestor-owner", {
        email: "owner@okan.test",
      })
      .firestore();

    await assertSucceeds(
      setDoc(
        doc(
          db,
          "academias",
          "academia-owner",
          "professores",
          "professor-2",
        ),
        {
          nome: "Professor Novo",
          email: "novo@okan.test",
        },
      ),
    );
  },
);

test(
  "usuario comum nao pode cadastrar professor em academia",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    await assertFails(
      setDoc(
        doc(
          db,
          "academias",
          "academia-owner",
          "professores",
          "professor-invasor",
        ),
        {
          nome: "Professor Invasor",
        },
      ),
    );
  },
);

test(
  "usuario pode enviar o proprio feedback beta",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    await assertSucceeds(
      setDoc(
        doc(db, "beta_feedback", "feedback-novo"),
        {
          userId: "aluno-1",
          mensagem: "Gostei do aplicativo",
        },
      ),
    );
  },
);

test(
  "usuario nao pode enviar feedback em nome de outra pessoa",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    await assertFails(
      setDoc(
        doc(db, "beta_feedback", "feedback-falso"),
        {
          userId: "personal-1",
          mensagem: "Feedback falso",
        },
      ),
    );
  },
);

test(
  "usuario comum nao pode ler feedback beta",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    await assertFails(
      getDoc(
        doc(db, "beta_feedback", "feedback-1"),
      ),
    );
  },
);

test(
  "aluno pode criar a propria anamnese",
  async () => {
    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    const ref = doc(
      db,
      "users",
      "aluno-1",
      "medical",
      "anamnese",
    );

    await assertSucceeds(
      setDoc(ref, {
        observacoes:
          "Anamnese preenchida pelo aluno",
      }),
    );
  },
);

test(
  "personal vinculado pode ler anamnese do aluno",
  async () => {
    await testEnv.withSecurityRulesDisabled(
      async (context) => {
        await setDoc(
          doc(
            context.firestore(),
            "users",
            "aluno-1",
            "medical",
            "anamnese",
          ),
          {
            observacoes:
              "Informacao confidencial",
          },
        );
      },
    );

    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    await assertSucceeds(
      getDoc(
        doc(
          db,
          "users",
          "aluno-1",
          "medical",
          "anamnese",
        ),
      ),
    );
  },
);

test(
  "personal nao vinculado nao pode ler anamnese",
  async () => {
    await testEnv.withSecurityRulesDisabled(
      async (context) => {
        await setDoc(
          doc(
            context.firestore(),
            "users",
            "aluno-1",
            "medical",
            "anamnese",
          ),
          {
            observacoes:
              "Informacao confidencial",
          },
        );
      },
    );

    const db = testEnv
      .authenticatedContext("personal-2", {
        email: "personal2@okan.test",
      })
      .firestore();

    await assertFails(
      getDoc(
        doc(
          db,
          "users",
          "aluno-1",
          "medical",
          "anamnese",
        ),
      ),
    );
  },
);

test(
  "personal vinculado pode criar sua nota privada",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    const noteRef = doc(
      db,
      "users",
      "aluno-1",
      "private_notes",
      "personal-1",
    );

    await assertSucceeds(
      setDoc(noteRef, {
        personalId: "personal-1",
        text: "Nota privada",
      }),
    );
  },
);

test(
  "personal vinculado pode ler sua propria nota privada",
  async () => {
    await testEnv.withSecurityRulesDisabled(
      async (context) => {
        await setDoc(
          doc(
            context.firestore(),
            "users",
            "aluno-1",
            "private_notes",
            "personal-1",
          ),
          {
            personalId: "personal-1",
            text: "Nota privada",
          },
        );
      },
    );

    const db = testEnv
      .authenticatedContext("personal-1", {
        email: "personal1@okan.test",
      })
      .firestore();

    await assertSucceeds(
      getDoc(
        doc(
          db,
          "users",
          "aluno-1",
          "private_notes",
          "personal-1",
        ),
      ),
    );
  },
);

test(
  "aluno nao pode ler nota privada do personal",
  async () => {
    await testEnv.withSecurityRulesDisabled(
      async (context) => {
        await setDoc(
          doc(
            context.firestore(),
            "users",
            "aluno-1",
            "private_notes",
            "personal-1",
          ),
          {
            personalId: "personal-1",
            text: "Nota privada",
          },
        );
      },
    );

    const db = testEnv
      .authenticatedContext("aluno-1", {
        email: "aluno@okan.test",
      })
      .firestore();

    await assertFails(
      getDoc(
        doc(
          db,
          "users",
          "aluno-1",
          "private_notes",
          "personal-1",
        ),
      ),
    );
  },
);

test(
  "outro personal nao pode ler nota privada",
  async () => {
    await testEnv.withSecurityRulesDisabled(
      async (context) => {
        await setDoc(
          doc(
            context.firestore(),
            "users",
            "aluno-1",
            "private_notes",
            "personal-1",
          ),
          {
            personalId: "personal-1",
            text: "Nota privada",
          },
        );
      },
    );

    const db = testEnv
      .authenticatedContext("personal-2", {
        email: "personal2@okan.test",
      })
      .firestore();

    await assertFails(
      getDoc(
        doc(
          db,
          "users",
          "aluno-1",
          "private_notes",
          "personal-1",
        ),
      ),
    );
  },
);

test(
  "outro personal nao pode sobrescrever nota privada",
  async () => {
    const db = testEnv
      .authenticatedContext("personal-2", {
        email: "personal2@okan.test",
      })
      .firestore();

    await assertFails(
      setDoc(
        doc(
          db,
          "users",
          "aluno-1",
          "private_notes",
          "personal-1",
        ),
        {
          personalId: "personal-2",
          text: "Tentativa indevida",
        },
      ),
    );
  },
);
const fs = require("fs");
const {
  before,
  after,
  beforeEach,
  test,
} = require("node:test");

const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");

const {
  doc,
  setDoc,
} = require("firebase/firestore");

const {
  ref,
  uploadBytes,
  getMetadata,
  deleteObject,
} = require("firebase/storage");

const PROJECT_ID = "app-academia-2914d";

let testEnv;

const imagemPequena = new Uint8Array([
  255,
  216,
  255,
  217,
]);

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,

    firestore: {
      rules: fs.readFileSync(
        "firestore.rules",
        "utf8",
      ),
    },

    storage: {
      rules: fs.readFileSync(
        "storage.rules",
        "utf8",
      ),
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();

  await testEnv.withSecurityRulesDisabled(
    async (context) => {
      const db = context.firestore();

      await setDoc(
        doc(db, "challenges", "challenge-1"),
        {
          creatorId: "aluno-1",
          participantIds: [
            "aluno-1",
            "personal-1",
          ],
          participants: {
            "aluno-1": {
              status: "accepted",
            },
            "personal-1": {
              status: "accepted",
            },
          },
        },
      );

      const storage = context.storage();

      await uploadBytes(
        ref(
          storage,
          "user_photos/personal-1.jpg",
        ),
        imagemPequena,
        {
          contentType: "image/jpeg",
        },
      );

      await uploadBytes(
        ref(
          storage,
          "arena_duels/challenge-1/100_personal-1.jpg",
        ),
        imagemPequena,
        {
          contentType: "image/jpeg",
        },
      );
    },
  );
});

test(
  "usuario pode enviar a propria foto de perfil",
  async () => {
    const storage = testEnv
      .authenticatedContext("aluno-1")
      .storage();

    await assertSucceeds(
      uploadBytes(
        ref(
          storage,
          "user_photos/aluno-1.jpg",
        ),
        imagemPequena,
        {
          contentType: "image/jpeg",
        },
      ),
    );
  },
);

test(
  "caminho legado de foto de perfil continua funcionando",
  async () => {
    const storage = testEnv
      .authenticatedContext("aluno-1")
      .storage();

    await assertSucceeds(
      uploadBytes(
        ref(
          storage,
          "profile_photos/aluno-1.jpg",
        ),
        imagemPequena,
        {
          contentType: "image/jpeg",
        },
      ),
    );
  },
);

test(
  "usuario nao pode gravar foto no nome de outra pessoa",
  async () => {
    const storage = testEnv
      .authenticatedContext("aluno-1")
      .storage();

    await assertFails(
      uploadBytes(
        ref(
          storage,
          "user_photos/personal-1.jpg",
        ),
        imagemPequena,
      ),
    );
  },
);

test(
  "usuario autenticado pode visualizar avatar de outro usuario",
  async () => {
    const storage = testEnv
      .authenticatedContext("aluno-1")
      .storage();

    await assertSucceeds(
      getMetadata(
        ref(
          storage,
          "user_photos/personal-1.jpg",
        ),
      ),
    );
  },
);

test(
  "usuario nao autenticado nao pode visualizar avatar",
  async () => {
    const storage = testEnv
      .unauthenticatedContext()
      .storage();

    await assertFails(
      getMetadata(
        ref(
          storage,
          "user_photos/personal-1.jpg",
        ),
      ),
    );
  },
);

test(
  "participante pode enviar imagem para o proprio duelo",
  async () => {
    const storage = testEnv
      .authenticatedContext("aluno-1")
      .storage();

    await assertSucceeds(
      uploadBytes(
        ref(
          storage,
          "arena_duels/challenge-1/200_aluno-1.jpg",
        ),
        imagemPequena,
        {
          contentType: "image/jpeg",
        },
      ),
    );
  },
);

test(
  "participante nao pode gravar arquivo usando uid de outro participante",
  async () => {
    const storage = testEnv
      .authenticatedContext("aluno-1")
      .storage();

    await assertFails(
      uploadBytes(
        ref(
          storage,
          "arena_duels/challenge-1/200_personal-1.jpg",
        ),
        imagemPequena,
      ),
    );
  },
);

test(
  "usuario de fora nao pode enviar imagem para duelo",
  async () => {
    const storage = testEnv
      .authenticatedContext("personal-2")
      .storage();

    await assertFails(
      uploadBytes(
        ref(
          storage,
          "arena_duels/challenge-1/200_personal-2.jpg",
        ),
        imagemPequena,
      ),
    );
  },
);

test(
  "usuario de fora nao pode ler imagem do duelo",
  async () => {
    const storage = testEnv
      .authenticatedContext("personal-2")
      .storage();

    await assertFails(
      getMetadata(
        ref(
          storage,
          "arena_duels/challenge-1/100_personal-1.jpg",
        ),
      ),
    );
  },
);

test(
  "participante pode apagar imagem do duelo",
  async () => {
    const storage = testEnv
      .authenticatedContext("aluno-1")
      .storage();

    await assertSucceeds(
      deleteObject(
        ref(
          storage,
          "arena_duels/challenge-1/100_personal-1.jpg",
        ),
      ),
    );
  },
);

test(
  "caminho desconhecido permanece bloqueado",
  async () => {
    const storage = testEnv
      .authenticatedContext("aluno-1")
      .storage();

    await assertFails(
      uploadBytes(
        ref(
          storage,
          "arquivos_aleatorios/teste.jpg",
        ),
        imagemPequena,
      ),
    );
  },
);

test(
  "arquivo acima de 10 MB e bloqueado",
  async () => {
    const storage = testEnv
      .authenticatedContext("aluno-1")
      .storage();

    const arquivoGrande =
      new Uint8Array(
        10 * 1024 * 1024 + 1,
      );

    await assertFails(
      uploadBytes(
        ref(
          storage,
          "user_photos/aluno-1.jpg",
        ),
        arquivoGrande,
        {
          contentType: "image/jpeg",
        },
      ),
    );
  },
);
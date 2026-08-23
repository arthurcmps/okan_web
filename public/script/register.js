import {
    createUserWithEmailAndPassword,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    collection,
    doc,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";

// =========================================================
// 1. MASCARAS E BUSCA DE CEP
// =========================================================

document.getElementById("reg-cnpj").addEventListener("input", (e) => {
    let v = e.target.value.replace(/\D/g, "");

    if (v.length > 14) {
        v = v.substring(0, 14);
    }

    v = v.replace(/^(\d{2})(\d)/, "$1.$2");
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
    v = v.replace(/(\d{4})(\d)/, "$1-$2");

    e.target.value = v;
});

document.getElementById("reg-telefone").addEventListener("input", (e) => {
    let v = e.target.value.replace(/\D/g, "");

    if (v.length > 11) {
        v = v.substring(0, 11);
    }

    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");

    e.target.value = v;
});

document.getElementById("reg-cep").addEventListener("input", async (e) => {
    let v = e.target.value.replace(/\D/g, "");

    if (v.length > 8) {
        v = v.substring(0, 8);
    }

    v = v.replace(/^(\d{5})(\d)/, "$1-$2");

    e.target.value = v;

    if (v.length !== 9) {
        return;
    }

    try {
        const cepLimpo = v.replace("-", "");
        const response = await fetch(
            `https://viacep.com.br/ws/${cepLimpo}/json/`
        );

        const data = await response.json();

        if (!data.erro) {
            document.getElementById("reg-endereco").value =
                `${data.logradouro}, `;

            document.getElementById("reg-bairro").value =
                data.bairro || "";

            document.getElementById("reg-uf").value =
                data.uf || "";

            document.getElementById("reg-endereco").focus();
        }
    } catch (error) {
        console.error("Erro ao buscar CEP:", error);
    }
});

// =========================================================
// 2. CADASTRO DA ACADEMIA
// =========================================================

const registerForm = document.getElementById("register-form");
const errorMessage = document.getElementById("error-message");
const btnRegister = document.getElementById("register-btn");

registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const gymName =
        document.getElementById("reg-gym-name").value.trim();

    const cnpj =
        document.getElementById("reg-cnpj").value.trim();

    const cep =
        document.getElementById("reg-cep").value.trim();

    const endereco =
        document.getElementById("reg-endereco").value.trim();

    const bairro =
        document.getElementById("reg-bairro").value.trim();

    const uf =
        document.getElementById("reg-uf").value.trim().toUpperCase();

    const adminName =
        document.getElementById("reg-admin-name").value.trim();

    const telefone =
        document.getElementById("reg-telefone").value.trim();

    const email =
        document.getElementById("reg-email").value
            .trim()
            .toLowerCase();

    const password =
        document.getElementById("reg-password").value;

    const confirmPassword =
        document.getElementById("reg-confirm-password").value;

    if (password !== confirmPassword) {
        errorMessage.textContent = "As senhas não coincidem.";
        return;
    }

    btnRegister.textContent = "A configurar ambiente...";
    btnRegister.disabled = true;
    errorMessage.textContent = "";

    let createdUser = null;
    let firestoreSetupCompleted = false;

    try {
        // -----------------------------------------------------
        // 1. CRIAR CONTA NO FIREBASE AUTH
        // -----------------------------------------------------

        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

        const user = userCredential.user;
        createdUser = user;

        /*
         * Usamos o e-mail devolvido pelo Firebase Auth.
         * Assim ele fica exatamente igual ao request.auth.token.email
         * utilizado pelas Firestore Rules.
         */
        const authenticatedEmail = user.email || email;

        // -----------------------------------------------------
        // 2. GERAR O ID DA ACADEMIA ANTES DE SALVAR
        // -----------------------------------------------------

        const academiaRef = doc(
            collection(db, "academias")
        );

        const userRef = doc(
            db,
            "users",
            user.uid
        );

        // -----------------------------------------------------
        // 3. CRIAR ACADEMIA + GESTOR NO MESMO BATCH
        // -----------------------------------------------------

        const batch = writeBatch(db);

        /*
         * Academia.
         *
         * ownerUid e emailGestor permitem que as Rules provem
         * que esta academia pertence ao usuario autenticado.
         */
        batch.set(academiaRef, {
            nome: gymName,
            emailGestor: authenticatedEmail,
            ownerUid: user.uid,

            cnpj: cnpj,
            telefoneResponsavel: telefone,
            cep: cep,
            endereco: endereco,
            bairro: bairro,
            uf: uf,

            licencasTotais: 0,
            licencasUsadas: 0,

            dataCadastro: serverTimestamp()
        });

        /*
         * Perfil do gestor.
         *
         * academiaId cria o vinculo inverso:
         *
         * users/{uid}.academiaId
         *          ->
         * academias/{academiaId}
         */
        batch.set(userRef, {
            uid: user.uid,
            name: adminName,
            email: authenticatedEmail,
            role: "gym_admin",
            academiaId: academiaRef.id,
            createdAt: serverTimestamp()
        });

        /*
         * O Firestore valida os dois documentos juntos.
         *
         * Se qualquer uma das duas operacoes for rejeitada,
         * nenhuma delas sera gravada.
         */
        await batch.commit();
        firestoreSetupCompleted = true;

        window.location.href = "dashboard.html";

    } catch (error) {
        if (createdUser && !firestoreSetupCompleted) {
            try {
                await deleteUser(createdUser);
            } catch (cleanupError) {
                console.error(
                    "Erro ao remover conta incompleta:",
                    cleanupError
                );
            }
        }
        console.error("Erro no cadastro:", error);

        if (error.code === "auth/email-already-in-use") {
            errorMessage.textContent =
                "Este e-mail já está cadastrado.";
        } else if (error.code === "permission-denied") {
            errorMessage.textContent =
                "Não foi possível concluir o cadastro da academia.";
        } else {
            errorMessage.textContent =
                "Erro ao criar conta. Verifique os dados.";
        }

        btnRegister.textContent = "Cadastrar Academia";
        btnRegister.disabled = false;
    }
});
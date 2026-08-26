import {
    createUserWithEmailAndPassword,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { auth } from "./firebase.js";
import { registerAcademy } from "./services/academy-registration-service.js";

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

    let authenticatedUser = null;
    let accountCreatedThisAttempt = false;
    let backendSetupCompleted = false;

    try {
        // -----------------------------------------------------
        // 1. GARANTIR CONTA AUTENTICADA
        // -----------------------------------------------------
        //
        // Se uma tentativa anterior criou o Auth mas a resposta
        // da Callable se perdeu, reaproveitamos a mesma sessao.
        // Isso torna o cadastro recuperavel sem duplicar contas.
        // -----------------------------------------------------

        const currentEmail =
            (auth.currentUser?.email || "").toLowerCase();

        if (auth.currentUser && currentEmail === email) {
            authenticatedUser = auth.currentUser;
        } else {
            const userCredential =
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

            authenticatedUser = userCredential.user;
            accountCreatedThisAttempt = true;
        }

        // -----------------------------------------------------
        // 2. SOLICITAR CADASTRO B2B AO BACKEND
        // -----------------------------------------------------
        //
        // O navegador nao cria role, academyId nem academia
        // diretamente. A Callable autenticada valida o usuario
        // e persiste academia + gym_admin atomicamente.
        // -----------------------------------------------------

        await registerAcademy({
            gymName,
            adminName,
            cnpj,
            telefone,
            cep,
            endereco,
            bairro,
            uf
        });

        backendSetupCompleted = true;
        window.location.href = "dashboard.html";

    } catch (error) {
        /*
         * So removemos uma conta criada nesta tentativa quando
         * o backend confirmou erro de argumento, isto e, antes
         * de qualquer persistencia valida. Falhas de rede/internal
         * preservam a conta para retry idempotente.
         */
        if (
            authenticatedUser &&
            accountCreatedThisAttempt &&
            !backendSetupCompleted &&
            error.code === "functions/invalid-argument"
        ) {
            try {
                await deleteUser(authenticatedUser);
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
        } else if (
            error.code === "functions/failed-precondition"
        ) {
            errorMessage.textContent =
                "Esta conta já possui um perfil cadastrado.";
        } else if (
            error.code === "functions/invalid-argument"
        ) {
            errorMessage.textContent =
                "Verifique os dados informados para a academia.";
        } else {
            errorMessage.textContent =
                "Não foi possível concluir o cadastro. Tente novamente.";
        }

        btnRegister.textContent = "Cadastrar Academia";
        btnRegister.disabled = false;
    }
});

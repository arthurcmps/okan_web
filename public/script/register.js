import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// IMPORTAÇÃO CENTRALIZADA
import { auth, db } from "./firebase.js";

// =========================================================
// 1. MÁSCARAS E BUSCA DE CEP AUTOMÁTICA
// =========================================================
document.getElementById('reg-cnpj').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g,"");
    if (v.length > 14) v = v.substring(0, 14);
    v = v.replace(/^(\d{2})(\d)/,"$1.$2");
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/,".$1/$2");
    v = v.replace(/(\d{4})(\d)/,"$1-$2");
    e.target.value = v;
});

document.getElementById('reg-telefone').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g,"");
    if (v.length > 11) v = v.substring(0, 11);
    v = v.replace(/^(\d{2})(\d)/g,"($1) $2");
    v = v.replace(/(\d)(\d{4})$/,"$1-$2");
    e.target.value = v;
});

document.getElementById('reg-cep').addEventListener('input', async (e) => {
    let v = e.target.value.replace(/\D/g,"");
    if (v.length > 8) v = v.substring(0, 8);
    v = v.replace(/^(\d{5})(\d)/,"$1-$2");
    e.target.value = v;
    
    if (v.length === 9) {
        try {
            const res = await fetch(`https://viacep.com.br/ws/${v.replace('-', '')}/json/`);
            const data = await res.json();
            if (!data.erro) {
                document.getElementById('reg-endereco').value = data.logradouro + ', ';
                document.getElementById('reg-bairro').value = data.bairro;
                document.getElementById('reg-uf').value = data.uf;
                document.getElementById('reg-endereco').focus();
            }
        } catch (e) { 
            console.error("Erro ao buscar CEP:", e); 
        }
    }
});

// =========================================================
// 2. LÓGICA DE CADASTRO
// =========================================================
const registerForm = document.getElementById('register-form');
const errorMessage = document.getElementById('error-message');
const btnRegister = document.getElementById('register-btn');

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const gymName = document.getElementById('reg-gym-name').value;
    const cnpj = document.getElementById('reg-cnpj').value;
    const cep = document.getElementById('reg-cep').value;
    const endereco = document.getElementById('reg-endereco').value;
    const bairro = document.getElementById('reg-bairro').value;
    const uf = document.getElementById('reg-uf').value.toUpperCase();
    const adminName = document.getElementById('reg-admin-name').value;
    const telefone = document.getElementById('reg-telefone').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;

    if (password !== confirmPassword) {
        errorMessage.textContent = "As senhas não coincidem.";
        return;
    }

    btnRegister.textContent = "A configurar ambiente...";
    btnRegister.disabled = true;
    errorMessage.textContent = "";

    try {
        // 1. Criar Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Criar Perfil de Gestor
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: adminName,
            email: email,
            role: "gym_admin",
            createdAt: serverTimestamp()
        });

        // 3. Salvar a Academia com zero licenças
        await addDoc(collection(db, "academias"), {
            nome: gymName,
            emailGestor: email,
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

        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Erro no cadastro:", error);
        if (error.code === 'auth/email-already-in-use') {
            errorMessage.textContent = "Este e-mail já está cadastrado.";
        } else {
            errorMessage.textContent = "Erro ao criar conta. Verifique os dados.";
        }
        btnRegister.textContent = "Cadastrar Academia";
        btnRegister.disabled = false;
    }
});
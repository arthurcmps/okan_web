import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBRbLUy03Y7628Lv3ruMy5PDq0Y3_zwykw",
  authDomain: "app-academia-2914d.firebaseapp.com",
  projectId: "app-academia-2914d",
  storageBucket: "app-academia-2914d.firebasestorage.app",
  messagingSenderId: "1080333508962",
  appId: "1:1080333508962:web:e93dccc19e32aaaf4ccc3b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =========================================================
// 1. MÁSCARAS E BUSCA DE CEP AUTOMÁTICA
// =========================================================
document.getElementById('reg-cnpj').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g,"");
    if (v.length > 14) v = v.substring(0, 14);
    v = v.replace(/^(\d{2})(\d)/,"$1.$2"); v = v.replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/,".$1/$2"); v = v.replace(/(\d{4})(\d)/,"$1-$2");
    e.target.value = v;
});

document.getElementById('reg-telefone').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g,"");
    if (v.length > 11) v = v.substring(0, 11);
    v = v.replace(/^(\d{2})(\d)/g,"($1) $2"); v = v.replace(/(\d)(\d{4})$/,"$1-$2");
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
        } catch (error) { console.error("Erro na busca de CEP:", error); }
    }
});


// =========================================================
// 2. LÓGICA DE REGISTRO
// =========================================================
const registerForm = document.getElementById('register-form');
const btnRegister = document.getElementById('register-btn');
const errorMessage = document.getElementById('error-message');

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Captura Dados de Acesso
    const adminName = document.getElementById('reg-admin-name').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;

    // Captura Dados da Academia
    const gymName = document.getElementById('reg-gym-name').value.trim();
    const cnpj = document.getElementById('reg-cnpj').value;
    const telefone = document.getElementById('reg-telefone').value;
    const cep = document.getElementById('reg-cep').value;
    const endereco = document.getElementById('reg-endereco').value.trim();
    const bairro = document.getElementById('reg-bairro').value.trim();
    const uf = document.getElementById('reg-uf').value.trim().toUpperCase();

    if (password !== confirmPassword) {
        errorMessage.textContent = "As senhas não coincidem.";
        return;
    }

    if (password.length < 6) {
        errorMessage.textContent = "A senha deve ter pelo menos 6 caracteres.";
        return;
    }

    btnRegister.textContent = "A configurar ambiente...";
    btnRegister.disabled = true;
    errorMessage.textContent = "";

    try {
        // 1. Cria a conta de Autenticação no Firebase
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Salva as regras de acesso do Gestor (Role: gym_admin)
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: adminName,
            email: email,
            role: "gym_admin",
            createdAt: serverTimestamp()
        });

        // 3. Salva a Academia com todos os dados preenchidos
        await addDoc(collection(db, "academias"), {
            nome: gymName,
            emailGestor: email,
            cnpj: cnpj,
            telefoneResponsavel: telefone,
            cep: cep,
            endereco: endereco,
            bairro: bairro,
            uf: uf,
            licencasTotais: 3, // O bónus inicial de 3 licenças
            licencasUsadas: 0,
            dataCadastro: serverTimestamp()
        });

        // 4. Redireciona o gestor direto para o painel dele
        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Erro no cadastro:", error);
        if (error.code === 'auth/email-already-in-use') {
            errorMessage.textContent = "Este e-mail já está cadastrado.";
        } else {
            errorMessage.textContent = "Erro ao criar conta. Verifique os dados e tente novamente.";
        }
        btnRegister.textContent = "Criar Conta e Acessar Painel";
        btnRegister.disabled = false;
    }
});
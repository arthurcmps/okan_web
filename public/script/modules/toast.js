// script/modules/toast.js

export function showToast(message, type = 'info') {
    // Procura o container na tela; se não existir, cria-o dinamicamente
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    // Cria o elemento da notificação
    const toast = document.createElement('div');
    const safeType = ['success', 'error', 'info'].includes(type)
        ? type
        : 'info';
    toast.className = `toast toast-${safeType}`;

    // Define o ícone e a cor baseando-se no tipo (sucesso, erro, info)
    let icon = 'info';
    let color = '#2196f3'; // Azul padrão
    
    if (safeType === 'success') { 
        icon = 'check_circle'; 
        color = '#00e676'; // Verde Okan
    } else if (safeType === 'error') { 
        icon = 'error'; 
        color = '#ff5252'; // Vermelho de erro
    }

    // Estrutura interna do Toast sem interpretar HTML da mensagem.
    const iconElement = document.createElement('span');
    iconElement.className = 'material-symbols-outlined toast-icon';
    iconElement.style.color = color;
    iconElement.textContent = icon;

    const messageElement = document.createElement('span');
    messageElement.style.flexGrow = '1';
    messageElement.textContent = String(message ?? '');

    toast.append(iconElement, messageElement);

    // Adiciona o Toast à tela
    container.appendChild(toast);

    // Pequeno delay para a animação do CSS funcionar corretamente (reflow)
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Remove a notificação após 4 segundos para limpar a memória do navegador
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300); // Aguarda a animação de saída terminar
    }, 4000);
}
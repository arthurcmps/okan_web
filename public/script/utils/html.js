const HTML_ENTITIES = Object.freeze({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '`': '&#96;'
});

/**
 * Escapa um valor para uso como texto dentro de HTML controlado.
 *
 * Preferir textContent sempre que a UI nao precisar de markup. Este helper
 * existe somente para templates HTML estaticos que ainda precisam manter
 * estrutura/estilo e recebem texto vindo do Firestore.
 *
 * @param {unknown} value Valor a renderizar.
 * @returns {string} Texto seguro para contexto HTML/atributo com aspas.
 */
export function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value).replace(
        /[&<>"'`]/g,
        (character) => HTML_ENTITIES[character]
    );
}

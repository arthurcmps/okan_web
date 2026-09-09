export function setupPasswordVisibility({
    inputId,
    toggleId,
    showAriaLabel = "Mostrar senha",
    hideAriaLabel = "Ocultar senha"
}) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);

    if (!input || !toggle) {
        return;
    }

    toggle.addEventListener("click", () => {
        const shouldShow = input.type === "password";

        input.type = shouldShow ? "text" : "password";
        toggle.textContent = shouldShow ? "Ocultar" : "Mostrar";
        toggle.setAttribute("aria-pressed", String(shouldShow));
        toggle.setAttribute(
            "aria-label",
            shouldShow ? hideAriaLabel : showAriaLabel
        );
    });
}

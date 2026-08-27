import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";
import { billingFunctions } from "../firebase.js";

const quoteAcademySubscriptionCallable =
    httpsCallable(
        billingFunctions,
        "obterCotacaoAssinaturaAcademia",
    );

const startAcademySubscriptionCallable =
    httpsCallable(
        billingFunctions,
        "iniciarAssinaturaAcademia",
    );

export async function getAcademySubscriptionQuote({
    licenseQuantity,
    billingDay
}) {
    const response = await quoteAcademySubscriptionCallable({
        quantidadeLicencas: licenseQuantity,
        diaCobranca: billingDay
    });

    return response.data;
}

export async function startAcademySubscription({
    licenseQuantity,
    billingDay,
    attemptId,
    cardTokenId
}) {
    const response = await startAcademySubscriptionCallable({
        quantidadeLicencas: licenseQuantity,
        diaCobranca: billingDay,
        attemptId,
        cardTokenId
    });

    return response.data;
}

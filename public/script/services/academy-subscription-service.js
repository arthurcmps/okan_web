import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";
import {
    billingFunctions,
    externalPaymentsEnabled
} from "../firebase.js";

function assertExternalPaymentsEnabled() {
    if (externalPaymentsEnabled) return;

    const error = new Error(
        "Pagamentos externos não estão disponíveis neste ambiente."
    );
    error.code = "payments/disabled-environment";
    throw error;
}

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
    assertExternalPaymentsEnabled();

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
    assertExternalPaymentsEnabled();

    const response = await startAcademySubscriptionCallable({
        quantidadeLicencas: licenseQuantity,
        diaCobranca: billingDay,
        attemptId,
        cardTokenId
    });

    return response.data;
}

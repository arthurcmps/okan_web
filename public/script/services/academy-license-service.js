import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";
import { functions } from "../firebase.js";

const grantAcademyLicenseCallable =
    httpsCallable(functions, "grantAcademyLicense");

const revokeAcademyLicenseCallable =
    httpsCallable(functions, "revokeAcademyLicense");

export async function grantAcademyLicense({
    academyId,
    professorEmail
}) {
    const response = await grantAcademyLicenseCallable({
        academyId,
        professorEmail
    });

    return response.data;
}

export async function revokeAcademyLicense({
    academyId,
    licenseId
}) {
    const response = await revokeAcademyLicenseCallable({
        academyId,
        licenseId
    });

    return response.data;
}

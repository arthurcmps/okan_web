import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";
import { functions } from "../firebase.js";

const registerAcademyCallable =
    httpsCallable(functions, "registerAcademy");

export async function registerAcademy(data) {
    const response = await registerAcademyCallable(data);
    return response.data;
}

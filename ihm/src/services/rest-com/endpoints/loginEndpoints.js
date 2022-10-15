import {deleteData, getData, postData} from "../rest";


export async function apiLogin(login, password) {
    return postData('/session', null, {login: login, password: password})
}

export async function apiSignup(login, password) {
    return postData('/signup', null, {login: login, password: password})
}

export async function apiLogout() {
    return deleteData('/session', null)
}

export async function apiGetSession() {
    return getData('/session')
}

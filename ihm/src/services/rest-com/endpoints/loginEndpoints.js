import {deleteData, getData, postData} from "../rest";


export async function apiLogin(login, password) {
    return postData('/api/session', null, {login: login, password: password})
}

export async function apiSignup(login, password) {
    return postData('/api/signup', null, {login: login, password: password})
}

export async function apiLogout() {
    return deleteData('/api/session', null)
}

export async function apiGetSession() {
    return getData('/api/session')
}

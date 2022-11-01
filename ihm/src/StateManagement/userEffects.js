import {apiGetSession, apiLogin, apiLogout, apiSignup} from "../services/rest-com/endpoints/loginEndpoints";
import {apiGetUserProfile} from "../services/rest-com/endpoints/userEndpoints";
import {updateSession} from "./userSlice";
import {getMyBasketEffect} from "./basketEffects";

export const initUser = () => async (dispatch, getState) => {
    const res = await apiGetSession()
    if (res.connected) {
        dispatch(completeUserProfileEffect(res))
    }
}

const completeUserProfileEffect = (newSession) => async (dispatch, getState) => {
    const res = await apiGetUserProfile(newSession['username']).catch(r => r)
    dispatch(updateSession({...newSession, profile: res}))
    dispatch(getMyBasketEffect())
}

export const tryLoginEffect = (login, password) => async (dispatch, getState) => {
    const res = await apiLogin(login, password).catch(err => null)

    if (!res) {
        dispatch(updateSession({}))
        return
    }

    dispatch(completeUserProfileEffect(res))
}

export const tryLogoutEffect = () => async (dispatch, getState) => {
    await apiLogout().catch(r => r)

    dispatch(updateSession({}))
}

export const trySignupEffect = (login, password) => async (dispatch, getState) => {
    const res = await apiSignup(login, password).catch(r => null)

    if (!res) {
        return
    }

    await tryLoginEffect(login, password)
}

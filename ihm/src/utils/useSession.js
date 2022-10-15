import {createContext, useContext, useEffect, useReducer} from "react";
import {apiGetSession, apiLogin, apiLogout, apiSignup} from "../services/rest-com/endpoints/loginEndpoints";
import {apiGetUserProfile} from "../services/rest-com/endpoints/userEndpoints";

const ContextSession = createContext([{}, x => x]);

export default function useSession() {
    const [session, setSession] = useContext(ContextSession);

    const completeUserProfile = async (newSession) => {
        const res = await apiGetUserProfile(newSession['username']).catch(r => r)
        setSession({...newSession, profile: res})
    }

    const tryLogin = async (login, password) => {
        const res = await apiLogin(login, password).catch(r => r)

        if (res.error) {
            setSession({})
            return
        }

        await completeUserProfile(res)
    }

    const tryLogout = async () => {
        await apiLogout().catch(r => r)

        setSession({})
    }

    const trySignup = async (login, password) => {
        const res = await apiSignup(login, password).catch(r => r)

        if (res.error) {
            return
        }

        await tryLogin(login, password)
    }

    useEffect(() => {
        if (!session.connected) {
            apiGetSession().then(res => {
                if (res.connected) {
                    completeUserProfile(res).then(x => x)
                }
            })
        }
    }, [])

    return [session, tryLogin, trySignup, tryLogout]
}

export const SessionProvider = ({children}) => {
    const providerState = useReducer((t, a) => a, {});

    return <ContextSession.Provider value={providerState}>
        {children}
    </ContextSession.Provider>
}

export {ContextSession}

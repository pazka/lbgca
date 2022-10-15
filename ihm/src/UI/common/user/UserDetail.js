import {useEffect, useState} from "react";
import {apiGetUserProfile} from "../../../services/rest-com/endpoints/userEndpoints";

export default function UserDetail({userId}) {
    const [user, setUser] = useState({})

    useEffect(() => {
        if (userId) {
            apiGetUserProfile(userId).then(res => {
                if (res.error) {
                    setUser({})
                }

                setUser(res)
            })
        }
    }, [userId])

    if (!userId)
        return null

    return <div>
        <h1>Page of {user.username} </h1>
    </div>
}

import {useEffect, useState} from "react";
import {apiGetUserProfile, apiPostUserProfile} from "../../../services/rest-com/endpoints/userEndpoints";
import {Button, Input} from "@mui/material";
import useSession from "../../../utils/useSession";
import {Uint8ToString} from "../../../utils/uint8arrayToBase64";
import Base64Avatar from "./Base64Avatar";

export default function UserEdit({userId}) {
    const [user, setUser] = useState({})
    const [newAvatar, setNewAvatar] = useState()
    const [error, setError] = useState()
    const [session, tryLogin, trySignup, tryLogout] = useSession()

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

    const fileUploaded = (fileInputEvent) => {
        const input = fileInputEvent.target
        const file = input.files.item(0)
        if (!file) {
            return
        }

        var reader = new FileReader();
        reader.onload = function () {
            const arrayBuffer = this.result
            const array = new Uint8Array(arrayBuffer)
            var b64encoded = btoa(Uint8ToString(array));

            setNewAvatar(b64encoded)
        }

        reader.readAsArrayBuffer(file);
    }

    const uploadAvatar = e => {
        apiPostUserProfile({...user, avatar: String(newAvatar)}).then(r => {
            setUser(r)
            setNewAvatar(null)
        }).catch(err => setError(err))
    }

    return <div>

        <Button color="secondary" onClick={x => tryLogout()}>Logout</Button>
        <div style={{display: "flex"}}>
            <Base64Avatar base64Avatar={newAvatar ?? user.avatar} text={user.username}/>
            <Input onChange={fileUploaded} type="file" id="file-input" title={"Upload new Avatar"}/>
            {newAvatar && <Button onClick={uploadAvatar}>Change the avatar</Button>}
        </div>
        {error && <p style={{color: 'red'}}>{error}</p>}
    </div>
}

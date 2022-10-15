import * as React from 'react';
import {useState} from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import {useNavigate} from "react-router-dom";
import useSession from "../../utils/useSession";
import Base64Avatar from "./user/Base64Avatar";
import {Dialog} from "@mui/material";
import LoginForm from "./LoginForm";

export default function Header() {
    const [session, tryLogin, trySignup, tryLogout] = useSession()
    const [loginModal, setLoginModal] = useState(false)
    const navigate = useNavigate()

    return (
        <Box sx={{flexGrow: 1}}>
            <AppBar position="static">
                <Toolbar>
                    <Button onClick={x => navigate("/")} color={"inherit"}>Order</Button>
                    <Button onClick={x => navigate("/create")} color={"inherit"}>All Orders</Button>
                    <div style={{flexGrow: 1}}></div>
                    {session.connected &&
                        <Button color={"inherit"} onClick={x => navigate("/user/" + session.username)}>
                            <span style={{marginRight: '1em'}}>{session.username}</span>
                            <Base64Avatar
                                base64Avatar={session?.profile?.avatar}
                                text={session.username}
                            />
                        </Button>}
                    {!session.connected && <Button
                        color="inherit"
                        onClick={x => setLoginModal(true)}
                    >Login</Button>}
                </Toolbar>

            </AppBar>
            <Dialog open={loginModal} onClose={x => setLoginModal(false)}>
                <LoginForm onClose={x => setLoginModal(false)}/>
            </Dialog>
        </Box>
    );
}

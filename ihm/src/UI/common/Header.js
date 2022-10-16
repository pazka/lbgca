import * as React from 'react';
import {useState} from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import {useNavigate} from "react-router-dom";

import Base64Avatar from "./user/Base64Avatar";
import {Dialog} from "@mui/material";
import LoginForm from "./LoginForm";
import {ShoppingBasket} from "@mui/icons-material";
import {useDispatch, useSelector} from "react-redux";
import basketSlice from "../../StateManagement/basketSlice";
import {withErrorCaught} from "../../utils/withErrorCaught";

function Header() {
    const session = useSelector(store => store.userSlice)
    const dispatch = useDispatch()
    const [loginModal, setLoginModal] = useState(false)
    const navigate = useNavigate()
    const orderInventory: basketSlice = useSelector(store => store.basketSlice) ?? {}

    return <div>
        <Box sx={{
            "&:before": {
                backgroundImage: "url(osier.jpg)",
                filter: "grayscale(100%)",
                position: "absolute",
                top: "0",
                left: "0",
            }
        }}>
            <Box sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative"
            }}>
                <img width={"200"} src="visuels/oeuf_petit_left.png" alt="logo"/>
                <img width={"800"} src="visuels/text.png" alt="logo"/>
            </Box>
        </Box>
        <Box
            sx={{
                flexGrow: 1
            }}>
            <Box
                sx={{
                    backgroundImage: "url(visuels/vichy_small.png)",
                    backgroundRepeat: "repeat",
                    width: "min(1000px,100%)",
                    margin: "auto"
                }}
            >
                <Toolbar>
                    <Button
                        onClick={x => navigate("/")}
                        variant={"contained"}
                        color={"primary"}
                    >
                        Les Oeufs du Magasin
                    </Button>
                    <Button
                        onClick={x => navigate("/all")}
                        variant={"contained"}
                        color={"primary"}
                    >
                        Les Paniers Commandés
                    </Button>
                    <div style={{flexGrow: 1}}></div>
                    {session.connected &&
                    <Button variant={"contained"}
                            color={"secondary"}
                            onClick={x => navigate("/user/" + session.username)}
                    >
                        <span style={{marginRight: '1em'}}>{session.username}</span>
                        <ShoppingBasket/>{orderInventory.basket?.length}
                    </Button>}
                    {!session.connected && <Button
                        variant={"contained"}
                        color={"secondary"}
                        onClick={x => setLoginModal(true)}
                    >Login</Button>}
                </Toolbar>

            </Box>
            <Dialog open={loginModal} onClose={x => setLoginModal(false)}>
                <LoginForm onClose={x => setLoginModal(false)}/>
            </Dialog>
        </Box>
    </div>
}

export default withErrorCaught(Header)
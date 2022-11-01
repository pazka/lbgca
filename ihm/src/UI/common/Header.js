import * as React from 'react';
import {useState} from 'react';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import {useNavigate} from "react-router-dom";
import {Dialog} from "@mui/material";
import LoginForm from "./LoginForm";
import {CheckBox, Logout, ShoppingBasket} from "@mui/icons-material";
import {useDispatch, useSelector} from "react-redux";
import basketSlice from "../../StateManagement/basketSlice";
import {withErrorCaught} from "../../utils/withErrorCaught";
import {tryLogoutEffect} from "../../StateManagement/userEffects";

function Header() {
    const orderInventory: basketSlice = useSelector(store => store.basketSlice)
    const session = useSelector(store => store.userSlice)
    const dispatch = useDispatch()
    const [loginModal, setLoginModal] = useState(false)
    const navigate = useNavigate()

    return <div className={"parent-parent-cover"}>
        <Box className={"parent-cover"}>
            <Box className={"image-cover"}/>
            <Box className={"image-cover"}/>
            <Box className={"inner-cover"}>
                <div className="logo"/>
                <div className="text-logo"/>
            </Box>
        </Box>
        <Box
            sx={{
                flexGrow: 1
            }}>
            <Box
                className={"header"}
            >
                <Toolbar sx={{
                    "&>*": {
                        marginRight: "1em",
                        boxShadow: "rgba(0, 0, 0, 0.19) 0px 10px 20px, rgba(0, 0, 0, 0.23) 0px 6px 6px;"
                    }
                }}>
                    <Button
                        onClick={x => navigate("/")}
                        variant={"contained"}
                        color={"primary"}
                    >
                        Présentation
                    </Button>
                    <Button
                        onClick={x => navigate("/products")}
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
                        Les Paniers
                    </Button>
                    <div style={{flexGrow: 1}}></div>
                    {session.connected &&
                    <>
                        <Button
                            variant={"contained"}
                            color={"secondary"}
                            onClick={x => navigate("/mybasket")}
                        >
                            <span style={{marginRight: '1em'}}>{session.username}</span>
                            <ShoppingBasket/><span>{orderInventory.basket.length}</span>
                            {orderInventory.basket[0]?.validated ? <CheckBox color={"primary"}/> : null}
                        </Button>
                        <Button
                            variant={"contained"}
                            onClick={x => dispatch(tryLogoutEffect())}
                        >
                            <Logout/>
                        </Button>

                    </>}
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
import './App.css';
import MainContent from "./UI/MainContent";
import Header from "./UI/common/Header";
import Footer from "./UI/common/Footer";
import * as React from "react";
import {useEffect} from "react";
import {useDispatch, useSelector} from "react-redux";
import {initInventory} from "./StateManagement/initEffects";
import {Box} from "@mui/material";
import LoginForm from "./UI/common/LoginForm";
import GuestContent from "./UI/GuestContent";

function App() {
    const dispatch = useDispatch()
    const session = useSelector(store => store.userSlice)

    useEffect(() => {
        dispatch(initInventory())
    })

    return (<>
            <Box className={"full-cover"}>
                <Box className={"full-covered-content"}>
                    <Header/>
                    {!session['profile'] && <GuestContent/>}
                    {session['profile'] && <MainContent/>}
                    <Footer/>
                </Box>
            </Box>

        </>
    );
}

export default App;

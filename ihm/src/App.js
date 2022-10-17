import './App.css';
import MainContent from "./UI/MainContent";
import Header from "./UI/common/Header";
import Footer from "./UI/common/Footer";
import {useEffect} from "react";
import {useDispatch} from "react-redux";
import {initInventory} from "./StateManagement/initEffects";
import {Box} from "@mui/material";
import * as React from "react";

function App() {
    const dispatch = useDispatch()

    useEffect(() => {
        dispatch(initInventory())
    })

    return (<>
            <Box>
                <Header/>
                <MainContent/>
                <Footer/>
            </Box>

        </>
    );
}

export default App;

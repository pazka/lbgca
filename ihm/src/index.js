import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import {BrowserRouter} from "react-router-dom";
import {store} from "./StateManagement/store";
import {Provider} from 'react-redux'
import {createTheme, ThemeProvider} from "@mui/material";


let theme = createTheme({
    palette: {
        text : {
            primary : '#222222',
            secondary : '#DDDDDD'
        },
        primary: {
            main: '#D371AA',
            light: '#E59DC7',
            dark: '#A12C71'
        },
        secondary: {
            main: '#9ECCED',
            light: '#CCE7FA',
            dark: '#73ADD6'
        },
    },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <Provider store={store}>
                <BrowserRouter>
                    <App/>
                </BrowserRouter>
            </Provider>
        </ThemeProvider>
    </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

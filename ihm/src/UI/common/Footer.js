import * as React from 'react';
import {Paper} from "@mui/material";

export default function Footer() {
    return (
        <footer style={{marginTop: '5em'}}>
            <Paper style={{
                margin : "auto",
                padding: '1em',
                color: "white",
                backgroundColor: "#1976d2",
                width: "50%",
                display: "flex",
                flexWrap: "wrap"
            }}>
                <pre>This website is only here to make our life easier in the process of creating dozen of testicle-based product. No money can be sent here.</pre>
            </Paper>
        </footer>
    );
}

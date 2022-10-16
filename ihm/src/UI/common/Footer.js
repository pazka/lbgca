import * as React from 'react';
import {Paper, useTheme} from "@mui/material";

export default function Footer() {
    const theme = useTheme()
    return (
        <footer style={{marginTop: '5em'}}>
            <Paper style={{
                margin: "auto",
                padding: '1em',
                color: "white",
                backgroundColor: theme.palette.primary.main,
                width: "50%",
                display: "flex",
                flexWrap: "wrap"
            }}>
                <p>
                    Ce site web n'est là que pour nous "faciliter" la vie dans le processus de création d'une douzaine de produits à base de testicules.
                    <br/>
                    On ne peut pas dépenser d'argent ici (mais le matériel coûte cher).
                </p>
            </Paper>
        </footer>
    );
}

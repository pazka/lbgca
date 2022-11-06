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
                    Ce site web n'est là que pour nous "faciliter" la vie dans le processus de création d'une douzaine de produits à base de testiculess et surtout vous faire rire ! On ne peut pas y dépenser d'argent (mais dieu sait que ça nous a coûté à réaliser).
                    <br/>
                    Si êtes chaud.e.s à chopper un objet pour la postérité, vous pouvez le faire en créant un panier ici.
                    <br/>
                    Le login ne sert qu'à lier la panier à un nom pour pas qu'on se perde. Si vous êtes content.e de la prestation, validez votre panier et laissez un commentaire !
                    <br/>
                    <code>xoxo Al² Studio</code>
                </p>
            </Paper>
        </footer>
    );
}

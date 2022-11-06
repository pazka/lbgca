import {Box} from "@mui/material";
import {Link} from "react-router-dom";

export default function HomePage({}) {
    return <Box>
        <video id={"videoCover"} width={"100%"} autoPlay={true} controls>
            <source src="video/night.mp4" type="video/mp4"/>
        </video>
        <Box className={"descBlock"}>
            <Box>
                <p>
                    Culminant l'expérience d'une artiste plasticienne internationale et 2 mois de travail, LBGCA™ vous propose l'apogée du monde sculptural
                </p>
            </Box>
            <Box id="descImg1" className={"imgDesc"}>

            </Box>
        </Box>
        <Box className={"descBlock"}>
            <Box id="descImg2" className={"imgDesc"}></Box>
            <Box>
                <p>
                    Notre intention : vous proposer un Memento à la hauteur de vos richesses perdues
                </p>
            </Box>
        </Box>
        <Box className={"descBlock"}>
            <Box>
                <p>
                    Résultant d'un processus impliquant alginate, silicone, plâtre, résine et peinture, nos nombreux essais ont aboutis à un détail plus vrai que nature
                </p>
            </Box>
            <Box id="descImg3" className={"imgDesc"}>
            </Box>
        </Box>
        <Box className={"descBlock"}>
            <Box id="descImg4" className={"imgDesc"}>

            </Box>
            <Box>
                <p>
                    Ce n'est donc pas une seule sculpture mais bien toute une gamme variée que LBGCA™ vous invite à découvrir dans notre section <Link to="/products">Les Oeufs du Magasin</Link>
                </p>
            </Box>
        </Box>
    </Box>
} 
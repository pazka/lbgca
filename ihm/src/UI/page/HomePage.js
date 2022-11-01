import {Box} from "@mui/material";

export default function HomePage({}) {
    return <Box>
        <video width={"100%"} autoPlay={true} controls>
            <source src="video/night.mp4" type="video/mp4"/>
        </video>
        <Box className={"descBlock"}>
            <Box>
                <p>
                    Today, science tells us that the essence of nature is serenity. You and I are pilgrims of the
                    dreamtime. We exist as meridians.
                </p>
            </Box>
            <Box id="descImg1" className={"imgDesc"}>

            </Box>
        </Box>
        <Box className={"descBlock"}>
            <Box id="descImg2" className={"imgDesc"}></Box>
            <Box>
                <p>
                    We are at a crossroads of learning and materialism. Reality has always been bursting with
                    storytellers
                    whose hearts are transformed into purpose. Who are we? Where on the great mission will we be
                    awakened?
                </p>
            </Box>
        </Box>
        <Box className={"descBlock"}>
            <Box>
                <p>
                    Soon there will be an invocation of beauty the likes of which the stratosphere has never seen. The
                    future will be a psychic invocation of starfire. The stratosphere is approaching a tipping point.
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
                    We are at a crossroads of learning and materialism. Reality has always been bursting with
                    storytellers
                    whose hearts are transformed into purpose. Who are we? Where on the great mission will we be
                    awakened?
                </p>
            </Box>
        </Box>
    </Box>
} 
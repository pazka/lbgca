
export const enovalysNavBar =theme=> ({
    /* width */
    "&::-webkit-scrollbar": {
        width: "0.5em",
        transition: "all 1s",
    },

    "&:hover::-webkit-scrollbar": {
        transition: "all 1s",
        width: "0.75em",
    },
    /* Track */
    "&::-webkit-scrollbar-track": {
        transition: "all 1s",
        backgroundColor: theme.palette.indication.light,
    },
    "&:hover::-webkit-scrollbar-track": {
        transition: "all 1s",
        backgroundColor: theme.palette.primary.light
    },

    /* Handle */
    "&::-webkit-scrollbar-thumb": {
        backgroundColor: theme.palette.primary.light,
        transition: "all 1s",
        borderRadius: "1em",
        "&:hover": {
            backgroundColor: theme.palette.primary.dark,
            width: "2em",
        }
    },
    "&:hover::-webkit-scrollbar-thumb": {
        transition: "all 1s",
        backgroundColor: theme.palette.primary.main
    }
})

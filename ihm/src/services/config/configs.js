const configs = Object.freeze({
    DEV: {
        name: "DEV",
        debug: true,
        baseUrl: "http://dev.localhost:8080"
    },
    PROD: {
        name: "PROD",
        debug: false,
        baseUrl: "https://lesbonnesgrossescouillesdalex.store"
    }
})

export default configs

import {withErrorCaught} from "../../utils/withErrorCaught";
import {useState} from "react";
import {
    Box,
    Button,
    Card,
    CardActions,
    CardContent,
    CardHeader,
    CardMedia,
    Dialog,
    DialogActions,
    DialogContent,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Typography,
    useTheme
} from "@mui/material";
import inventory from "../../domain/inventory.json"
import {AddShoppingCart, ArrowCircleLeft, ArrowCircleRight, ZoomIn} from "@mui/icons-material";
import {useDispatch, useSelector} from "react-redux";
import {addOrderToBasketEffect} from "../../StateManagement/basketEffects";


function ProductDisplay(
    {
        product, readonly
    }: {
        product: Product,
        readonly: boolean
    }
) {
    const displayOptions = useSelector(store => store.displaySlice)
    const basket = useSelector(store => store.basketSlice.basket)
    const [currImgIndex, setCurrImgIndex] = useState(0)
    const [currVariant, setCurrVariant] = useState(inventory.globalVariants[0].name)
    const [currOption, setCurrOption] = useState((product.variants ?? [])[0])
    const [currVariantColor, setCurrVariantColor] = useState(inventory.globalVariants[0].colors[0])
    const [isZoom, setIsZoom] = useState(false)
    const dispatch = useDispatch()
    const theme = useTheme()

    const handleSetNewVariant = (variantName) => {
        const variant = inventory.globalVariants.find(v => v.name === variantName)
        if (!variant.colors.includes(currVariantColor)) {
            setCurrVariantColor(variant.colors[0])
        }
        setCurrVariant(variant.name)
    }

    const handleChangeVariant = (amount) => e => {
        let newIndex = currImgIndex + amount
        newIndex < 0 && (newIndex = (product.images.length - 1))
        newIndex >= product.images.length && (newIndex = 0)

        setCurrImgIndex(newIndex)
    }

    const handleAddProductToBasket = () => {
        dispatch(addOrderToBasketEffect(product, inventory.globalVariants.find(v => v.name === currVariant), currVariantColor, currOption))
    }

    return <div className={"product-display"}>
        <Dialog maxWidth open={isZoom} onClose={x => setIsZoom(!isZoom)}>
            <DialogContent>
                <img style={{width: "auto", height: "80vh"}} src={product.images[currImgIndex]}
                     alt="product image zoomed"/>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleChangeVariant(-1)}>
                    <ArrowCircleLeft/>
                </Button>
                <Button onClick={handleChangeVariant(+1)}>
                    <ArrowCircleRight/>
                </Button>
                <Button color={"secondary"} variant={"contained"} onClick={x => setIsZoom(!isZoom)}> Fermer</Button>
            </DialogActions>
        </Dialog>
        <Card>
            <CardHeader
                sx={{
                    backgroundColor: theme.palette.primary.light
                }}
                color={"secondary"}
                title={product.name}
                action={
                    !basket[0]?.validated ? (<Button
                        variant={"contained"}
                        color="secondary"
                        aria-label="order"
                        onClick={x => handleAddProductToBasket()}
                    >
                        <AddShoppingCart/>
                    </Button>) : <div></div>
                }
            />
            <CardMedia
                sx={(displayOptions.noSpoil ? {
                    filter: "blur(0.5em)"
                } : {})}
                component="img"
                height="194"
                image={product.images[currImgIndex]}
                alt={product.name + " photo"}
            />
            <CardContent>
                <Box sx={{
                    position: "absolute"
                }}>
                    <Box sx={{
                        position: "absolute",
                        top: "-8em",
                        "&>*": {
                            boxShadow: "rgba(0, 0, 0, 0.19) 0px 10px 20px, rgba(0, 0, 0, 0.23) 0px 6px 6px;"
                        }
                    }}>
                        <IconButton size={"small"} color={"primary"} onClick={handleChangeVariant(-1)}>
                            <ArrowCircleLeft/>
                        </IconButton>
                        <IconButton size={"small"} color={"primary"} onClick={handleChangeVariant(+1)}>
                            <ArrowCircleRight/>
                        </IconButton>
                        <IconButton size={"small"} color={"primary"} onClick={x => setIsZoom(!isZoom)}>
                            <ZoomIn/>
                        </IconButton>
                    </Box>
                </Box>
                {product.description.map((desc, i) => <Typography
                    sx={{marginBottom: '0.5em'}}
                    variant="body2"
                    color="text.primary.main"
                    key={i}
                >
                    {desc}
                </Typography>)}
            </CardContent>
            <CardActions
                disableSpacing
                sx={{
                    backgroundColor: theme.palette.secondary.light,
                    '& >*': {
                        margin: '0.5em'
                    }
                }}
            >
                <FormControl fullWidth>
                    <InputLabel id="generalVariant">Matière</InputLabel>
                    <Select
                        variant={"standard"}
                        labelId="generalVariant"
                        id="generalVariant"
                        value={currVariant}
                        label="generalVariant"
                        onChange={e => handleSetNewVariant(e.target.value)}
                    >
                        {inventory.globalVariants.map((variant: Variant, i) => (
                            <MenuItem key={i} value={variant.name}>{variant.name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl fullWidth>
                    <InputLabel id="generalVariantColor">Couleur</InputLabel>
                    <Select
                        variant={"standard"}
                        labelId="generalVariantColor"
                        id="generalVariantColor"
                        value={currVariantColor}
                        label="generalVariantColor"
                        onChange={e => setCurrVariantColor(e.target.value)}
                    >
                        {inventory.globalVariants.find(v => v.name === currVariant).colors.map((color, i) => (
                            <MenuItem key={i} value={color}>{color}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                {
                    product.variants && <FormControl fullWidth>
                        <InputLabel id="currOption">Option</InputLabel>
                        <Select
                            variant={"standard"}
                            labelId="currOption"
                            id="currOption"
                            value={currOption}
                            label="currOption"
                            onChange={e => setCurrOption(e.target.value)}
                        >
                            {product.variants.map((v, i) => (
                                <MenuItem key={i} value={v}>{v}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                }
            </CardActions>
        </Card>
        <div>
        </div>
    </div>
}

export default withErrorCaught(ProductDisplay)

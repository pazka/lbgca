export const getAverageRgb = (src, cb) => {
    const context = document.createElement("canvas").getContext("2d");
    const img = new Image();
    img.setAttribute("crossOrigin", "");
    img.src = src;
    img.onload = () => {
        context.imageSmoothingEnabled = true;
        context.drawImage(img, 0, 0, 1, 1);
        const data = context.getImageData(0, 0, 1, 1).data
        const dataArray = data.slice(0,3)
        cb(dataArray)
    };
};

export const getLorem = (nb) => {
    const choices = [
        "Sed feugiat, libero ac faucibus lobortis, nulla dui tristique ante, ac suscipit risus lorem aliquam dolor.",
        "Donec et ex sed est posuere tincidunt eu vel eros.",
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque interdum nunc vel ligula sodales, nec auctor lorem gravida. Sed porta venenatis justo a rhoncus. Nulla eu dignissim nisi. ",
        "Nullam interdum sem ut lacus consequat scelerisque eget at elit.",
        "Pellentesque vehicula bibendum nisl, at fringilla mauris sollicitudin in. Fusce facilisis magna ac mauris sollicitudin, in lobortis ex gravida. Pellentesque suscipit felis lorem, eget varius mi imperdiet vel."
    ]
    
    return new Array(nb).fill(0).map(x => choices[Math.floor(Math.random() * choices.length)])
}
export const getShortName = (name?: string) => {
  // Se 'name' não existir (for null, undefined, ou ""), retorna string vazia
  if (!name) {
    return "";
  }

  // 1. Divide o nome pelos espaços: ["felipe", "santos", "marcelino"]
  const nameParts = name.split(" ");
  console.log("nameParts", nameParts);

  // 2. Pega apenas os 2 primeiros: ["felipe", "santos"]
  const firstTwoNames = nameParts.slice(0, 2);

  console.log("firstTwoNames", firstTwoNames.join(" "));

  // 3. Junta eles com um espaço: "felipe santos"
  return firstTwoNames.join(" ");
};

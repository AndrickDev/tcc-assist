import { extractKeywords } from "./src/lib/papers-search";

const title = "ARQUITETURA HEXAGONAL E DOMAIN-DRIVEN DESIGN COMO FUNDAMENTO DE UM SISTEMA WEB PARA REENCONTRO ENTRE PETS E TUTORES";

console.log("8:", extractKeywords(title, 8));
console.log("5:", extractKeywords(title, 5));
console.log("3:", extractKeywords(title, 3));
console.log("2:", extractKeywords(title, 2));

import "server-only";

/**
 * Amostra das senhas mais vazadas (listas públicas tipo "top 10k" + variações
 * brasileiras). Comparação em minúsculas. Em produção, complementar com a API
 * k-anonymity do Have I Been Pwned.
 */
export const COMMON_PASSWORDS = new Set<string>([
  "123456", "1234567", "12345678", "123456789", "1234567890", "12345678910", "0123456789",
  "0987654321", "9876543210", "1111111111", "0000000000", "1234512345", "1122334455", "1212121212",
  "123123123", "1231231234", "123321123", "147258369", "159753456", "741852963", "987654321",
  "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd",
  "p@ssword123", "qwerty", "qwerty123", "qwerty1234", "qwertyuiop", "qwertyuiop1", "asdfghjkl",
  "asdfghjkl1", "zxcvbnm", "zxcvbnm123", "1q2w3e4r5t", "1q2w3e4r5t6y", "q1w2e3r4t5", "1qaz2wsx3edc",
  "abc123", "abcd1234", "abcdef1234", "abcdefghij", "abcdefgh12", "a1b2c3d4e5", "aa123456",
  "iloveyou", "iloveyou1", "iloveyou123", "princess", "sunshine", "football", "baseball",
  "basketball", "superman", "batman", "pokemon", "starwars", "whatever", "welcome", "welcome1",
  "welcome123", "letmein", "letmein123", "trustno1", "dragon", "monkey", "master", "shadow",
  "michael", "jennifer", "computer", "internet", "changeme", "changeme123", "administrator",
  "admin", "admin123", "admin1234", "admin12345", "administrador", "root", "toor", "test",
  "test1234", "test12345", "teste", "teste123", "teste1234", "teste12345", "default",
  // pt-BR
  "senha", "senha1", "senha12", "senha123", "senha1234", "senha12345", "senha123456",
  "minhasenha", "minhasenha1", "minhasenha123", "mudar123", "mudar1234", "mudarsenha",
  "trocar123", "acesso123", "entrar123", "brasil", "brasil123", "brasil2022", "brasil2026",
  "flamengo", "flamengo123", "corinthians", "corinthians1", "palmeiras", "palmeiras1",
  "saopaulo", "saopaulo123", "santos", "vasco", "gremio", "cruzeiro", "botafogo", "fluminense",
  "internacional", "atletico", "amoreterno", "teamo", "teamo123", "euteamo", "meuamor",
  "jesus", "jesus123", "jesuscristo", "deusefiel", "deuseamor", "familia", "familia123",
  "felicidade", "estrela", "beijinho", "gatinha", "princesa", "chocolate", "morango",
  "abacaxi", "vitoria", "gabriel", "lucas", "mateus", "rafael", "juliana", "mariana",
  "fernanda", "carolina", "amanda", "camila", "bruna", "beatriz", "larissa",
  // marca / contexto (ataques direcionados)
  "quadra", "quadra123", "quadra1234", "quadra2026", "quadrasp", "streetwear", "provador",
  "loja123", "lojaquadra", "kimkriss", "kimkriss123", "kimkriss1234", "kimkriss2026", "lojakimkriss",
]);

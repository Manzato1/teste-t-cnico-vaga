const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 4000;
const SECRET_KEY = 'sua_chave_secreta';

app.use(express.json());

const users = [];
const favorites = {}; 
const queryCount = {}; 


function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token não fornecido' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });

    req.user = user;
    next();
  });
}


app.get('/', (req, res) => {
  res.send('API funcionando! 🚀');
});


app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuário e senha obrigatórios' });
  }

  const existingUser = users.find(u => u.username === username);
  if (existingUser) {
    return res.status(409).json({ message: 'Usuário já existe' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ username, password: hashedPassword });

  res.status(201).json({ message: 'Usuário cadastrado com sucesso' });
});


app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(401).json({ message: 'Usuário não encontrado' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ message: 'Senha incorreta' });
  }

  const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token });
});


app.get('/characters', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  let username = 'guest';

  if (token) {
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      username = decoded.username;
    } catch (err) {
      return res.status(403).json({ message: 'Token inválido' });
    }
  }

  if (!queryCount[username]) {
    queryCount[username] = 0;
  }

  const limit = username === 'guest' ? 3 : 10;

  if (queryCount[username] >= limit) {
    return res.status(429).json({ message: 'Limite de consultas atingido' });
  }

  queryCount[username]++;

  const name = req.query.name;
  const url = name
    ? `https://rickandmortyapi.com/api/character/?name=${encodeURIComponent(name)}`
    : 'https://rickandmortyapi.com/api/character';

  try {
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(404).json({ message: 'Personagem não encontrado' });
  }
});


app.post('/favorites/:id', authenticateToken, (req, res) => {
  const username = req.user.username;
  const characterId = parseInt(req.params.id);

  if (!favorites[username]) {
    favorites[username] = [];
  }

  if (favorites[username].includes(characterId)) {
    return res.status(409).json({ message: 'Personagem já está nos favoritos' });
  }

  if (favorites[username].length >= 3) {
    return res.status(403).json({ message: 'Limite de 3 favoritos atingido' });
  }

  favorites[username].push(characterId);
  console.log('Favoritos atuais:', favorites);

  res.json({ message: `Personagem ${characterId} favoritado por ${username}` });
});


app.get('/favorites', authenticateToken, async (req, res) => {
  const username = req.user.username;
  const userFavorites = (favorites[username] || []).filter(id => !isNaN(id));

  try {
    const promises = userFavorites.map(id =>
      axios.get(`https://rickandmortyapi.com/api/character/${id}`)
    );
    const responses = await Promise.all(promises);
    const characters = responses.map(r => r.data);

    res.json(characters);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar favoritos' });
  }
});

app.get('/favorites/episodes', authenticateToken, async (req, res) => {
  const username = req.user.username;
  const userFavorites = favorites[username] || [];

  try {
    const promises = userFavorites.map(id =>
      axios.get(`https://rickandmortyapi.com/api/character/${id}`)
    );
    const responses = await Promise.all(promises);

    const result = responses.map(r => ({
      id: r.data.id,
      name: r.data.name,
      episodeCount: r.data.episode.length
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar episódios dos favoritos' });
  }
});


app.delete('/favorites/:id', authenticateToken, (req, res) => {
  const username = req.user.username;
  const characterId = Number(req.params.id);

if (isNaN(characterId)) {
  return res.status(400).json({ message: 'ID inválido' });
}

  if (!favorites[username]) {
    return res.status(404).json({ message: 'Usuário não tem favoritos' });
  }

  const index = favorites[username].indexOf(characterId);
  if (index === -1) {
    return res.status(404).json({ message: 'Personagem não está nos favoritos' });
  }

  favorites[username].splice(index, 1);
  console.log('Favoritos atuais:', favorites);

  res.json({ message: `Personagem ${characterId} removido dos favoritos de ${username}` });
});


app.get('/favorites/episodes/unique', authenticateToken, async (req, res) => {
  const username = req.user.username;
  const userFavorites = favorites[username] || [];

  try {
    const promises = userFavorites.map(id =>
      axios.get(`https://rickandmortyapi.com/api/character/${id}`)
    );
    const responses = await Promise.all(promises);

    const allEpisodes = responses.flatMap(r => r.data.episode);
    const uniqueEpisodes = [...new Set(allEpisodes)];

    res.json({ totalUniqueEpisodes: uniqueEpisodes.length });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao calcular episódios únicos' });
  }
});


app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
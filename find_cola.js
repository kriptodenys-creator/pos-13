const Database = require('better-sqlite3');
const db = new Database('data/pos_system.db');

const rows = db.prepare(`
  SELECT id, name_uk, name_lt, price 
  FROM menu_items 
  WHERE name_uk LIKE '%Coca%' OR name_lt LIKE '%Coca%' OR name_uk LIKE '%Cola%' OR name_lt LIKE '%Cola%'
  ORDER BY name_uk
`).all();

console.log('Найденные блюда:');
rows.forEach(r => console.log(`id=${r.id} | uk=${r.name_uk} | lt=${r.name_lt} | price=${r.price}`));

db.close();

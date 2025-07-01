import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return (
    <div>
      <header>
        <nav>
          <a href="#novosti">Novosti</a>
          <a href="#onama">O nama</a>
          <a href="#kontakt">Kontakt</a>
          <a href="#galerija">Galerija</a>
          <a href="#blog">Blog</a>
        </nav>
      </header>
      <main>
        <h1>Dobrodošli u Vranjic!</h1>
        <p>Malo mjesto pokraj Splita s morem, kamenjem i alpinima.</p>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

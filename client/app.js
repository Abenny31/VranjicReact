const e = React.createElement;

function App() {
  return e('div', null,
    e('header', null,
      e('nav', null,
        e('a', {href: '#novosti'}, 'Novosti'),
        e('a', {href: '#onama'}, 'O nama'),
        e('a', {href: '#kontakt'}, 'Kontakt'),
        e('a', {href: '#galerija'}, 'Galerija'),
        e('a', {href: '#blog'}, 'Blog')
      )
    ),
    e('main', null,
      e('h1', null, 'Dobrodošli u Vranjic!'),
      e('p', null, 'Malo mjesto pokraj Splita s morem, kamenjem i alpinima.')
    )
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(e(App));

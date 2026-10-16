# ASCII Art Studio

**Convierte texto en arte ASCII**, de [Un Fantasma en el Sistema](https://www.unfantasmaenelsistema.com).

▶ **Abrir:** https://unfantasmaenelsistema.github.io/ASCII-ART-STUDIO/

Escribe un texto y conviértelo en letras gigantes hechas con caracteres, para banners de terminal, el MOTD de un servidor, la cabecera de un script, el README de un repositorio o un writeup de CTF.

## Qué hace

- **11 fuentes FIGlet** reales (Standard, Big, Slant, Small, Doom, Banner, Bloques, Sombra ANSI, Calvin S, Ghost y Dot Matrix), interpretadas por la propia app a partir de los archivos `.flf`.
- **Texto libre:** dibuja cualquier texto (ñ, tildes, emojis, otros alfabetos) con una tipografía del sistema y lo convierte a caracteres según la luminosidad.
- **Español sin sorpresas:** Standard, Big, Slant y Small traen la ñ y las tildes; en las demás fuentes el acento se dibuja encima de la letra. Si a una fuente le falta algún carácter, la app te lo dice.
- **Ajustes:** anchura máxima (el texto pasa a la línea siguiente si no cabe) y espaciado (el de la fuente, letras juntas o más separación).
- **Juegos de caracteres:** el original de la fuente, bloques Unicode, minimalista, ultradenso, puntos, Matrix, Braille, líneas o uno personalizado.
- **Efectos:** sombra, contorno, 3D, reflejo lateral e inferior (con los caracteres simétricos girados: `/` ↔ `\`, `(` ↔ `)`, `▀` ↔ `▄`…), onda, glitch y escalonado. También invertir, espejo, marco y negrita.
- **Color:** sólido, degradados, arcoíris, mapa de calor, Matrix, ciberpunk, fuego y aleatorio.
- **Transformaciones:** mayúsculas, minúsculas, al revés, leet, Morse, ROT13, Zalgo, alfabeto OTAN, binario y hexadecimal (en UTF-8).
- **Exportación:** TXT, HTML (con color), SVG y PNG con cada carácter en su columna (no se descuadra aunque falten glifos en la fuente) y JSON con los ajustes.
- Presets, historial (restaura texto y ajustes), atajo Ctrl + Enter, español/inglés y tema claro/oscuro.

## Privacidad

Todo se procesa en tu navegador; el texto no sale de tu equipo.

## Estructura

```
index.html      interfaz
ascii-core.js   núcleo sin dependencias: intérprete FIGlet, efectos, color (se puede probar con Node)
fonts/*.flf     fuentes FIGlet
icono.png       logo de la casa
```

La app carga las fuentes con `fetch`, así que en local hay que servirla: `python -m http.server` y abre `http://localhost:8000`.

## Créditos de las fuentes

Las fuentes de `fonts/` son archivos FIGlet sin modificar, con la autoría y las condiciones en su cabecera:

- **Standard** (Glenn Chappell e Ian Chai, ampliada por John Cowan), **Big**, **Slant** y **Small** (Glenn Chappell; Big con caracteres griegos de Bruce Jakeway), de la distribución de [FIGlet](http://www.figlet.org/).
- **Doom** (Frans P. de Vries), **Banner** (Ryan Youck), **Dot Matrix** (Curtis Wanner) y **Ghost** (myflix).
- **ANSI Regular**, **ANSI Shadow** y **Calvin S**, convertidas de fuentes TheDraw con el editor de [patorjk.com](http://patorjk.com/software/taag/).

## English

**ASCII Art Studio** turns text into ASCII art with 11 real FIGlet fonts (parsed by the app itself) or with any system typeface (accents, emoji and other scripts included). It handles Spanish accents, wraps to a maximum width, and offers character sets, effects with proper character mirroring, colour gradients and transforms. Exports to TXT, HTML, SVG and PNG with every character on its own grid column, plus JSON. Everything runs in your browser. Bilingual (ES/EN), light/dark themes.

## Licencia / License

Código: [MIT](LICENSE) © Un Fantasma en el Sistema. Las fuentes FIGlet conservan los créditos y condiciones de sus autores.

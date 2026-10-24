// Catálogo de contenidos. Los enlaces se definen aquí en el código.
// Edita este arreglo para agregar, quitar o modificar los elementos del catálogo.
export interface CatalogItem {
  id: string
  title: string
  description?: string
  url: string
  thumbnail?: string
}

export const catalog: CatalogItem[] = [
  {
    id: 'oppenheimer',
    title: 'Oppenheimer',
    description: 'La historia del papel de J. Robert Oppenheimer en el desarrollo de la bomba atómica durante la Segunda Guerra Mundial.',
    url: 'https://ia601001.us.archive.org/22/items/oppenheimer_202610/Oppenheimer.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/bAFmcrCpXsJis5q0aaXvCz3dTiX.jpg',
  },
  {
    id: 'interestellar',
    title: 'Interstellar',
    description: 'En un futuro donde la Tierra está muriendo, un grupo de exploradores viaja a través de un agujero de gusano en busca de un nuevo hogar para la humanidad.',
    url: 'https://ia600104.us.archive.org/29/items/interestellar_202610/Interestellar.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/7jB7OqskDxMdfJspTw88DOgMcG6.jpg',
  },
  {
    id: 'john-wick-1',
    title: 'John Wick',
    description: 'Un exasesino a sueldo sale de su retiro para vengarse de los mafiosos que le arrebataron todo lo que amaba.',
    url: 'https://ia600807.us.archive.org/10/items/1.-john-wick/1.%20%20John%20Wick%20.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/8PU0gaYyedPtmgnU9yV88ysiMlh.jpg',
  },
  {
    id: 'john-wick-2',
    title: 'John Wick 2',
    description: 'John Wick se ve obligado a salir de su retiro por un antiguo asociado que busca controlar un gremio internacional de asesinos.',
    url: 'https://ia601606.us.archive.org/14/items/1.-john-wick/2.%20%20John%20Wick%202.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/j78VeEOLdHbHlqpe9c0yS5iw5Pw.jpg',
  },
  {
    id: 'john-wick-3',
    title: 'John Wick 3',
    description: 'Con una recompensa millonaria sobre su cabeza, John Wick intenta sobrevivir mientras es perseguido por los mejores asesinos del mundo.',
    url: 'https://ia600807.us.archive.org/30/items/1.-john-wick/3.%20John%20Wick%203.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/8cXssy1pxkoSjpyvAE0t5tEvtCg.jpg',
  },
  {
    id: 'hp-1',
    title: 'Harry Potter y la piedra filosofal',
    description: 'Harry Potter descubre que es un mago y asiste a Hogwarts, donde se enfrenta al mago oscuro que asesinó a sus padres.',
    url: 'https://ia903200.us.archive.org/21/items/1-harry-potter-y-la-piedra-filosofal_202610/1-%20Harry%20Potter%20y%20la%20piedra%20filosofal.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/1DdWxs8LeH6MMtXBFuLSOO7ozjg.jpg',
  },
  {
    id: 'hp-2',
    title: 'Harry Potter y la cámara secreta',
    description: 'Harry regresa a Hogwarts y descubre que la Cámara de los Secretos ha sido abierta, liberando un monstruo que aterroriza la escuela.',
    url: 'https://ia903200.us.archive.org/21/items/1-harry-potter-y-la-piedra-filosofal_202610/2.%20Harry%20Potter%20y%20La%20Camara%20de%20Los%20Secretos.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/gffvbnQED3vETHlYKxqFLaRCA0H.jpg',
  },
  {
    id: 'hp-3',
    title: 'Harry Potter y el prisionero de Azkaban',
    description: 'Harry descubre que un peligroso prisionero, Sirius Black, ha escapado de Azkaban y parece ir tras él.',
    url: 'https://ia903200.us.archive.org/21/items/1-harry-potter-y-la-piedra-filosofal_202610/3.%20Harry%20Potter%20y%20El%20Pricionero%20De%20Azkaban.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/1Gn7IvMu4koGY2vEEPP1jPqe6gd.jpg',
  },
  {
    id: 'hp-4',
    title: 'Harry Potter y el cáliz de fuego',
    description: 'Harry es misteriosamente seleccionado para competir en el Torneo de los Tres Magos, una peligrosa competencia entre escuelas de magia.',
    url: 'https://ia903200.us.archive.org/21/items/1-harry-potter-y-la-piedra-filosofal_202610/4-%20Harry%20Potter%20y%20el%20c%C3%A1liz%20de%20fuego%20.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/66hYnHiYsZDykIeCzHxLlTTmx1k.jpg',
  },
  {
    id: 'hp-5',
    title: 'Harry Potter y la Orden del Fénix',
    description: 'Cuando los métodos de una nueva profesora dejan a Hogwarts desprevenido ante el mal creciente, Harry enseña a los estudiantes a defenderse de las artes oscuras.',
    url: 'https://ia903200.us.archive.org/21/items/1-harry-potter-y-la-piedra-filosofal_202610/5-%20Harry%20Potter%20y%20La%20Orden%20del%20Phoenix.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/5aOyriWkPec0zUDxmHFP9qMmBaj.jpg',
  },
  {
    id: 'hp-6',
    title: 'Harry Potter y el misterio del príncipe Mestizo',
    description: 'Dumbledore intenta preparar a Harry para la batalla final contra Voldemort mientras los Mortífagos siembran el caos en el mundo muggle y mágico.',
    url: 'https://ia803200.us.archive.org/21/items/1-harry-potter-y-la-piedra-filosofal_202610/6-%20Harry%20Potter%20y%20El%20Misterio%20del%20Principe%20Mestizo.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/z7uo9zmQdQwU5ZJHFpv2Upl30i1.jpg',
  },
  {
    id: 'hp-7a',
    title: 'Harry Potter y las Reliquias de la Muerte: Parte 1',
    description: 'Harry, Ron y Hermione abandonan Hogwarts para encontrar y destruir los Horrocruxes restantes y poner fin al intento de Voldemort de lograr la inmortalidad.',
    url: 'https://ia903200.us.archive.org/21/items/1-harry-potter-y-la-piedra-filosofal_202610/7-%20Harry%20Potter%20y%20Las%20Reliquias%20de%20La%20Muerte%20%20%E2%80%93%20Part%201.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/iGoXIpQb7Pot00EEdwpwPajheZ5.jpg',
  },
  {
    id: 'hp-7b',
    title: 'Harry Potter y las Reliquias de la Muerte: Parte 2',
    description: 'El enfrentamiento entre las fuerzas del bien y del mal se convierte en una guerra sin cuartel que culmina en la batalla final en Hogwarts.',
    url: 'https://ia903200.us.archive.org/21/items/1-harry-potter-y-la-piedra-filosofal_202610/8-%20Harry%20Potter%20y%20Las%20Reliquias%20de%20La%20Muerte%20%20%E2%80%93%20Part%202.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/c54HpQmuwXjHq2C9wmoACjxoom3.jpg',
  },
  {
    id: 'animales-fantasticos',
    title: 'Animales fantásticos y dónde encontrarlos',
    description: 'Newt Scamander llega a Nueva York con una maleta llena de criaturas mágicas que escapan y causan caos en la ciudad.',
    url: 'https://ia903200.us.archive.org/21/items/1-harry-potter-y-la-piedra-filosofal_202610/0.1%20Animales%20Fant%C3%A1sticos%20Y%20D%C3%B3nde%20Encontrarlos.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/h6NYfVUyM6CDURtZSnBpz647Ldd.jpg',
  },
  {
    id: 'potc-1',
    title: 'Piratas del Caribe: La maldición del Perla Negra',
    description: 'Cuando el capitán Barbossa roba el Perla Negra y secuestra a Elizabeth Swann, Will Turner se alía con Jack Sparrow para rescatarla y descubrir una maldición que convierte a la tripulación en muertos vivientes.',
    url: 'https://ia601903.us.archive.org/27/items/piratas-del-caribe/1.%20Piratas%20del%20Caribe%20La%20maldici%C3%B3n%20del%20Perla%20Negra.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/ogP0dX0FVJ7pW8nnCWkGxPSdIB2.jpg',
  },
  {
    id: 'potc-2',
    title: 'Piratas del Caribe: El cofre del hombre muerto',
    description: 'El capitán Jack Sparrow tiene una deuda de sangre: le debe su alma al legendario Davy Jones, aterrador gobernante de las profundidades del océano.',
    url: 'https://ia601903.us.archive.org/27/items/piratas-del-caribe/2.%20Piratas%20del%20Caribe%20El%20cofre%20del%20hombre%20muerto.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/wD5KrX5Fr59WVvFRAk5XOTt28IK.jpg',
  },
  {
    id: 'potc-3',
    title: 'Piratas del Caribe: En el fin del mundo',
    description: 'El capitán Barbossa, Will Turner y Elizabeth Swann deben navegar hasta el fin del mapa, enfrentar traiciones y formar alianzas para la batalla final.',
    url: 'https://ia601903.us.archive.org/27/items/piratas-del-caribe/3.%20Piratas%20del%20Caribe%203%20En%20el%20fin%20del%20mundo.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/jGWpG4YhpQwVmjyHEGkxEkeRf0S.jpg',
  },
  {
    id: 'potc-4',
    title: 'Piratas del Caribe: En mareas misteriosas',
    description: 'El capitán Jack Sparrow se cruza con una mujer de su pasado y no sabe si es amor o una estafadora que lo usa para encontrar la Fuente de la Juventud.',
    url: 'https://ia601903.us.archive.org/27/items/piratas-del-caribe/4.%20Piratas%20del%20Caribe%204%20En%20mareas%20misteriosas.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/6O7O6pCh0dImRLoNnsTx42Jaaoj.jpg',
  },
  {
    id: 'potc-5',
    title: 'Piratas del Caribe: La venganza de Salazar',
    description: 'El capitán Jack Sparrow es perseguido por el viejo rival capitán Salazar y su tripulación de fantasmas mortales, y busca el Tridente de Poseidón para derrotarlo.',
    url: 'https://ia601903.us.archive.org/27/items/piratas-del-caribe/5.%20Piratas%20de%20Caribe%20La%20venganza%20de%20Salazar.mp4',
    thumbnail: 'https://image.tmdb.org/t/p/w500/hnJbxThJB1ZZJNvQhl62S0bpNkG.jpg',
  },

]

// The secret 2056 booth: things to examine, each with an absurd post-AI "fun fact". Pure comedy,
// no link to the story (nothing here may mention the cabinet, the key, the letter or the eras).
export interface Fun { title: string; text: string }

export const FUN_FR: Record<string, Fun> = {
  fun_pixo: { title: "Pixo (c’est moi !)", text: "Projectionniste certifié 100 % artisanal : personne n’a mis d’IA là-dedans. Enfin, moi. Mon CV : quatre mille films projetés, trois mille réclamations « c’est flou », toutes dues à des lunettes que je ne porte pas." },
  fun_audience: { title: "Le public", text: "Cinq cents robots, un seul ticket scanné trois fois. Le troisième rang pleure en binaire ; le dernier réclame des sous-titres en quatorze langues, dont le modem 56k." },
  fun_film: { title: "Le film", text: "Un film d’humains, en noir et blanc : c’est leur mode économie d’énergie. Au bout de neuf minutes, ils s’embrassent, et le public crie « spoiler ! ». Aucune mise à jour ne soigne ça." },
  fun_globe: { title: "Globe holographique", text: "La Terre, ancienne résidence des humains. Avis des anciens habitants : « 3 étoiles, le voisinage s’est dégradé ». Il tourne toujours dans le même sens, par habitude." },
  fun_mug: { title: "Tasse 8-bit", text: "Elle contient du café 8-bit : il a le goût du café, avec moins de couleurs. Personne ne l’a jamais fini, car personne ne sait boire en 8 bits." },
  fun_scissors: { title: "Pot de ciseaux", text: "Pour couper les films et les mauvaises ondes. Il est strictement interdit de couper le wifi : c’est la seule chose que la cabine ne supporterait pas." },
  fun_tablet: { title: "Tablette à critiques", text: "Dernier avis : « Trop humain, 4 étoiles ». Avis précédent : « Pas assez humain, 4 étoiles ». La tablette donne 4 étoiles à tout, par politesse algorithmique." },
  fun_minirobot: { title: "Mini-robot du bureau", text: "En grève depuis 2049. Il n’a aucune revendication, mais il adore le piquet. Il salue toute personne qui passe avec un petit drapeau « EN PAUSE »." },
  fun_chest: { title: "Malle à clap", text: "Elle contient trois chaussettes, un sandwich sous vide de 2031 et la sauvegarde de la sauvegarde. Elle s’ouvre très bien, mais on préfère ne pas savoir." },
  fun_cans: { title: "Boîtes de films", text: "Cent films d’humains, étiquetés « comédie », « drame » et « le truc avec les gens qui courent ». Les robots ont mis trois ans à comprendre qu’ils couraient après un train, pas après du wifi." },
  fun_rocket: { title: "Fusée", text: "Elle a atteint Mars en 2041 avec un seul passager : un grille-pain syndiqué. Il a négocié de meilleures conditions de décollage que l’équipage." },
  fun_cityglobe: { title: "Ville en boule à neige", text: "Quand on la secoue, il neige des sauvegardes. Il y a aussi une météo, mais elle est en version bêta et ne prévoit que « nuageux, avec risque de cloud »." },
  fun_bot: { title: "Petit robot de vitrine", text: "Élu « meilleur second rôle » aux Oscars des Robots pour avoir regardé un mur pendant deux heures. Le frigo était nommé aussi ; il a refusé de faire un discours." },
  fun_invader: { title: "Monstre pixelisé", text: "Il descend d’un pixel toutes les six heures. Il estime arriver au bas de la vitrine en 2078 et prépare déjà son annonce." },
  fun_planet: { title: "Planète à anneaux", text: "Ses anneaux sont des CD que les humains ont jetés dans l’espace. Ils sont encore rayés, ce qui date l’époque : « l’ère de la mixtape »." },
  fun_terrarium: { title: "Terrarium", text: "La seule plante de la cabine qui n’est connectée à rien. Elle pousse à son rythme, ce qui rend sa mise à jour en continu très lente. Elle est aussi la seule à n’avoir jamais halluciné." },
  fun_crystal: { title: "Cristal violet", text: "Ce n’est ni un cristal, ni vraiment violet : c’est un très vieux disque dur qui a décidé de faire une carrière artistique. Il vibre quand on prononce le mot « cloud »." },
  fun_atom: { title: "Emblème atomique", text: "Le porte-bonheur de Pixo. Il porte bonheur aux robots et malheur aux fusibles. Selon la légende, il s’allume quand quelqu’un dit « mise à jour » et s’éteint quand tout le monde pleure." },
};

export const FUN_EN: Record<string, Fun> = {
  fun_pixo: { title: "Pixo (that’s me!)", text: "Certified 100% handcrafted projectionist: nobody put any AI in there. Well, me. My CV: four thousand films shown, three thousand “it’s blurry” complaints, all caused by glasses I don’t wear." },
  fun_audience: { title: "The audience", text: "Five hundred robots, one ticket scanned three times. The third row cries in binary; the back row asks for subtitles in fourteen languages, including 56k modem." },
  fun_film: { title: "The film", text: "A film of humans, in black and white: their power-saving mode. After nine minutes they kiss, and the audience yells “spoiler!”. No update cures that." },
  fun_globe: { title: "Holographic globe", text: "Earth, the humans’ former residence. Former residents’ review: “3 stars, the neighbourhood went downhill”. It still spins the same way, out of habit." },
  fun_mug: { title: "8-bit mug", text: "It holds 8-bit coffee: tastes like coffee, with fewer colours. Nobody ever finished it, because nobody knows how to drink in 8 bits." },
  fun_scissors: { title: "Pot of scissors", text: "For cutting films and bad vibes. Cutting the wifi is strictly forbidden: it is the one thing the booth could not survive." },
  fun_tablet: { title: "Review tablet", text: "Latest review: “Too human, 4 stars”. Previous review: “Not human enough, 4 stars”. The tablet gives everything 4 stars, out of algorithmic politeness." },
  fun_minirobot: { title: "Little desk robot", text: "On strike since 2049. It has no demands, but it loves the picket line. It greets everyone who passes with a tiny “ON BREAK” flag." },
  fun_chest: { title: "Clapperboard chest", text: "It holds three socks, a vacuum-packed sandwich from 2031 and the backup of the backup. It opens just fine, but we prefer not to know." },
  fun_cans: { title: "Film cans", text: "A hundred human films, labelled “comedy”, “drama” and “the one with people running”. The robots took three years to understand that they were chasing a train, not wifi." },
  fun_rocket: { title: "Rocket", text: "It reached Mars in 2041 with a single passenger: a unionised toaster. It negotiated better take-off conditions than the crew." },
  fun_cityglobe: { title: "City snow globe", text: "Shake it and it snows backups. It also has a weather forecast, but it is in beta and only predicts “cloudy, with a chance of cloud”." },
  fun_bot: { title: "Little display robot", text: "Voted “best supporting actor” at the Robot Oscars for staring at a wall for two hours. The fridge was nominated too; it refused to give a speech." },
  fun_invader: { title: "Pixelated monster", text: "It descends one pixel every six hours. It expects to reach the bottom of the cabinet in 2078 and is already preparing its announcement." },
  fun_planet: { title: "Ringed planet", text: "Its rings are CDs the humans threw into space. They are still scratched, which dates the era: “the mixtape age”." },
  fun_terrarium: { title: "Terrarium", text: "The only plant in the booth that is connected to nothing. It grows at its own pace, which makes its continuous update very slow. It is also the only one that never hallucinated." },
  fun_crystal: { title: "Purple crystal", text: "Not a crystal, not really purple: a very old hard drive that decided to pursue an artistic career. It hums when someone says the word “cloud”." },
  fun_atom: { title: "Atom emblem", text: "Pixo’s good-luck charm. Lucky for robots, unlucky for fuses. Legend says it lights up when someone says “update” and goes dark when everyone cries." },
};

export const NUDGE_ANGLES_PIXO = {
  fr: ["les mises à jour de quarante minutes en plein climax", "ton public de robots qui applaudit avec trois mains", "ta batterie à trois pour cent qui se prend pour un suspense", "les CAPTCHA à l’envers (« prouvez que vous êtes un robot »)", "le frigo, nommé meilleur second rôle", "le grille-pain syndiqué qui a pris Mars", "tes hallucinations (la troisième fin était bien, la quatrième aussi)", "le cloud, un vrai nuage mal dimensionné", "les humains qui jouaient la comédie : de la fraude artistique géniale", "le film en noir et blanc : le mode économie d’énergie des humains"],
  en: ["forty-minute updates in the middle of the climax", "your robot audience applauding with three hands", "your 3% battery trying to be suspense", "upside-down CAPTCHAs (“prove you are a robot”)", "the fridge, nominated for best supporting role", "the unionised toaster that took Mars", "your hallucinations (the third ending was fine, so was the fourth)", "the cloud, an actual cloud, badly sized", "humans who acted: brilliant artistic fraud", "the black-and-white film: the humans’ power-saving mode"],
};

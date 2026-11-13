/**
 * Dicionário UI consumer — FR / HT (Kreyòl Ayisyen).
 */

import type { UiLocale } from "./uiLocale";

export type UiCopyKey =
  | "shell.nav"
  | "shell.home"
  | "shell.plan"
  | "shell.bible"
  | "shell.profile"
  | "common.close"
  | "common.clear"
  | "common.confirm"
  | "common.cancel"
  | "common.reload"
  | "common.error"
  | "common.loading"
  | "common.book"
  | "common.chapters"
  | "home.greeting.morning"
  | "home.greeting.afternoon"
  | "home.greeting.evening"
  | "home.continue"
  | "home.openBible"
  | "home.dailyVerse"
  | "home.share"
  | "home.plans"
  | "home.resumePlan"
  | "home.discoverPlans"
  | "home.read"
  | "home.seeAll"
  | "home.days"
  | "home.plansEmpty"
  | "home.browsePlans"
  | "plan.title"
  | "plan.discover"
  | "plan.empty"
  | "plan.resume"
  | "plan.start"
  | "plan.inProgress"
  | "plan.all"
  | "plan.emptyHint"
  | "plan.catalogError"
  | "plan.catalogErrorHint"
  | "plan.offline"
  | "plan.offlineHint"
  | "profile.title"
  | "profile.history"
  | "profile.clearHistory"
  | "profile.clearHistoryConfirm"
  | "profile.signIn"
  | "profile.signOut"
  | "profile.connectAccount"
  | "profile.tab.account"
  | "profile.tab.prefs"
  | "profile.tab.storage"
  | "profile.tab.history"
  | "profile.tab.admin"
  | "profile.account"
  | "auth.titleUpgrade"
  | "auth.titleSoftGate"
  | "auth.leadUpgrade"
  | "auth.leadSoftGate"
  | "auth.google"
  | "auth.or"
  | "auth.email"
  | "auth.password"
  | "auth.signIn"
  | "auth.register"
  | "auth.sendLink"
  | "auth.createAccount"
  | "auth.forgotPassword"
  | "auth.backToSignIn"
  | "auth.later"
  | "auth.resetSent"
  | "auth.errorEmail"
  | "auth.errorPassword"
  | "auth.showPassword"
  | "auth.hidePassword"
  | "auth.error.generic"
  | "auth.error.invalidCredential"
  | "auth.error.wrongPassword"
  | "auth.error.userNotFound"
  | "auth.error.emailInUse"
  | "auth.error.weakPassword"
  | "auth.error.tooManyRequests"
  | "auth.error.network"
  | "auth.error.popupClosed"
  | "auth.signOutConfirm"
  | "auth.signOutConfirmOffline"
  | "auth.signOutConfirmAction"
  | "onboarding.welcomeTitle"
  | "onboarding.welcomeLead"
  | "onboarding.fullName"
  | "onboarding.errorName"
  | "onboarding.submit"
  | "onboarding.cancel"
  | "toast.offline"
  | "toast.markSaved"
  | "profile.theme"
  | "profile.settings"
  | "profile.appearance"
  | "profile.language"
  | "profile.langFr"
  | "profile.langHt"
  | "profile.themeLight"
  | "profile.themeDark"
  | "profile.storage"
  | "profile.download"
  | "profile.ready"
  | "profile.historyEmpty"
  | "profile.marks"
  | "profile.marksEmpty"
  | "profile.calculating"
  | "history.title"
  | "history.empty"
  | "history.recent"
  | "history.clearAll"
  | "history.clearAllConfirm"
  | "history.delete"
  | "history.close"
  | "history.count"
  | "history.countOne"
  | "bible.searchWord"
  | "bible.history"
  | "bible.prevChapter"
  | "bible.nextChapter"
  | "bible.chapters"
  | "bible.chapterN"
  | "bible.bookChapter"
  | "bible.nav"
  | "bible.menu"
  | "bible.menuBible"
  | "bible.version"
  | "bible.versionGroup"
  | "bible.tools"
  | "bible.offlineReady"
  | "bible.offlineDownload"
  | "bible.offlineDownloading"
  | "bible.offlineBusy"
  | "bible.font"
  | "bible.fontSize"
  | "bible.fontSmaller"
  | "bible.fontLarger"
  | "bible.text"
  | "bible.planProgress"
  | "bible.planPrev"
  | "bible.planNext"
  | "offline.title"
  | "offline.lead"
  | "offline.reconnectTitle"
  | "offline.reconnectLead"
  | "offline.downloading"
  | "offline.waiting"
  | "offline.downloadCta"
  | "install.bannerTitle"
  | "install.bannerLead"
  | "install.bannerCta"
  | "install.bannerBusy"
  | "install.phase.s21"
  | "install.phase.ht98"
  | "install.phase.tske"
  | "install.phase.plans"
  | "install.error"
  | "swUpdate.title"
  | "swUpdate.lead"
  | "swUpdate.cta"
  | "searchBooks.title"
  | "searchBooks.back"
  | "searchBooks.close"
  | "searchBooks.placeholder"
  | "searchBooks.search"
  | "searchBooks.empty"
  | "searchBooks.chapters"
  | "searchBooks.chAbbr"
  | "searchBooks.chaptersCount"
  | "study.title"
  | "study.close"
  | "study.context"
  | "study.refs"
  | "study.crossRefs"
  | "study.application"
  | "study.notes"
  | "study.tabs"
  | "study.notesLabel"
  | "study.contextEmpty"
  | "study.appEmpty"
  | "study.refsEmpty"
  | "study.notesPlaceholder"
  | "study.notesSaved"
  | "study.notesDraft"
  | "study.loadError"
  | "study.refUnavailable"
  | "verse.actions"
  | "verse.hint"
  | "verse.hintMulti"
  | "verse.mark"
  | "verse.unmark"
  | "verse.share"
  | "verse.shareCopied"
  | "verse.shareFailed"
  | "verse.colorTitle"
  | "word.placeholder"
  | "word.aria"
  | "word.panel"
  | "word.ot"
  | "word.nt"
  | "word.dc"
  | "word.recents"
  | "word.suggestions"
  | "word.filterBook"
  | "word.apply"
  | "word.showAll"
  | "word.partial"
  | "word.count"
  | "word.empty"
  | "word.fuzzy"
  | "word.or"
  | "word.unavailable";

type Dict = Record<UiCopyKey, string>;

const FR: Dict = {
  "shell.nav": "Navigation",
  "shell.home": "Accueil",
  "shell.plan": "Plan",
  "shell.bible": "Bible",
  "shell.profile": "Profil",
  "common.close": "Fermer",
  "common.clear": "Effacer",
  "common.confirm": "Confirmer ?",
  "common.cancel": "Annuler",
  "common.reload": "Recharger",
  "common.error": "Une erreur est survenue",
  "common.loading": "Chargement…",
  "common.book": "Livre",
  "common.chapters": "Chapitres",
  "home.greeting.morning": "Bonjour",
  "home.greeting.afternoon": "Bon après-midi",
  "home.greeting.evening": "Bonsoir",
  "home.continue": "Continuer la lecture",
  "home.openBible": "Ouvrir la Bible",
  "home.dailyVerse": "Verset du jour",
  "home.share": "Partager",
  "home.plans": "Plans de lecture",
  "home.resumePlan": "Reprendre",
  "home.discoverPlans": "Découvrir les plans",
  "home.read": "Lire →",
  "home.seeAll": "Voir tout",
  "home.days": "{done}/{total} jours",
  "home.plansEmpty": "Choisissez un parcours guidé dans l’onglet Plan.",
  "home.browsePlans": "Parcourir les plans",
  "plan.title": "Plans",
  "plan.discover": "Découvrir",
  "plan.empty": "Aucun plan disponible",
  "plan.resume": "Reprendre",
  "plan.start": "Commencer",
  "plan.inProgress": "En cours",
  "plan.all": "Tous les plans",
  "plan.emptyHint":
    "Les parcours guidés apparaîtront ici dès qu’ils seront publiés.",
  "plan.catalogError": "Catalogue indisponible",
  "plan.catalogErrorHint": "Impossible de charger les plans pour le moment.",
  "plan.offline": "Plans hors ligne",
  "plan.offlineHint":
    "Le catalogue n’est pas configuré sur cet appareil. Vous pouvez toujours ouvrir la Bible.",
  "profile.title": "Profil",
  "profile.history": "Historique",
  "profile.clearHistory": "Effacer",
  "profile.clearHistoryConfirm": "Confirmer ?",
  "profile.signIn": "Se connecter",
  "profile.signOut": "Se déconnecter",
  "profile.connectAccount": "Connecter un compte",
  "profile.tab.account": "Compte",
  "profile.tab.prefs": "Préfs",
  "profile.tab.storage": "Stockage",
  "profile.tab.history": "Historique",
  "profile.tab.admin": "Admin",
  "profile.account": "Compte",
  "auth.titleUpgrade": "Sauvegarder mes études",
  "auth.titleSoftGate": "Garde tes surlignages",
  "auth.leadUpgrade":
    "Connecte-toi avec Google pour synchroniser marques, notes et plans entre tes appareils.",
  "auth.leadSoftGate":
    "En mode invité, tu peux marquer jusqu’à 10 versets sur cet appareil. Connecte Google pour continuer et retrouver tes surlignages partout.",
  "auth.google": "Continuer avec Google",
  "auth.or": "ou",
  "auth.email": "E-mail",
  "auth.password": "Mot de passe",
  "auth.signIn": "Se connecter",
  "auth.register": "Créer un compte",
  "auth.sendLink": "Envoyer le lien",
  "auth.createAccount": "Créer un compte",
  "auth.forgotPassword": "Mot de passe oublié ?",
  "auth.backToSignIn": "Retour à la connexion",
  "auth.later": "Plus tard",
  "auth.resetSent":
    "E-mail de réinitialisation envoyé. Vérifie ta boîte de réception.",
  "auth.errorEmail": "Indique ton e-mail.",
  "auth.errorPassword": "Mot de passe : au moins 6 caractères.",
  "auth.showPassword": "Afficher le mot de passe",
  "auth.hidePassword": "Masquer le mot de passe",
  "auth.error.generic": "Connexion impossible. Réessaie dans un instant.",
  "auth.error.invalidCredential":
    "E-mail ou mot de passe incorrect.",
  "auth.error.wrongPassword": "Mot de passe incorrect.",
  "auth.error.userNotFound": "Aucun compte trouvé pour cet e-mail.",
  "auth.error.emailInUse": "Cet e-mail est déjà associé à un compte.",
  "auth.error.weakPassword":
    "Mot de passe trop faible (au moins 6 caractères).",
  "auth.error.tooManyRequests":
    "Trop de tentatives. Réessaie plus tard.",
  "auth.error.network": "Réseau indisponible. Vérifie ta connexion.",
  "auth.error.popupClosed": "Connexion annulée.",
  "auth.signOutConfirm":
    "Tes données synchronisées restent en sécurité dans le cloud et reviendront à la prochaine connexion. Elles seront retirées de cet appareil.",
  "auth.signOutConfirmOffline":
    "Tu es hors ligne : les modifications pas encore envoyées peuvent être perdues.",
  "auth.signOutConfirmAction": "Se déconnecter de cet appareil",
  "onboarding.welcomeTitle": "Bienvenue",
  "onboarding.welcomeLead":
    "Confirme ou ajuste ton nom. Ton compte synchronise tes données entre appareils.",
  "onboarding.fullName": "Nom complet",
  "onboarding.errorName": "Indique ton nom complet pour continuer.",
  "onboarding.submit": "Continuer",
  "onboarding.cancel": "Annuler",
  "toast.offline": "Hors ligne — tout reste enregistré sur cet appareil.",
  "toast.markSaved": "Surlignage enregistré",
  "profile.theme": "Thème",
  "profile.settings": "Préférences",
  "profile.appearance": "Apparence",
  "profile.language": "Langue",
  "profile.langFr": "Français",
  "profile.langHt": "Kreyòl",
  "profile.themeLight": "Clair",
  "profile.themeDark": "Sombre",
  "profile.storage": "Stockage",
  "profile.download": "Télécharger",
  "profile.ready": "Prêt",
  "profile.historyEmpty": "Aucune lecture enregistrée pour le moment.",
  "profile.marks": "Surlignages",
  "profile.marksEmpty": "Aucun verset surligné pour le moment.",
  "profile.calculating": "Calcul…",
  "history.title": "Historique",
  "history.empty": "Aucune lecture enregistrée pour l’instant.",
  "history.recent": "Chapitres ouverts récemment",
  "history.clearAll": "Effacer tout",
  "history.clearAllConfirm": "Effacer tout l’historique de lecture ?",
  "history.delete": "Supprimer",
  "history.close": "Fermer l’historique",
  "history.count": "{n} lectures",
  "history.countOne": "{n} lecture",
  "bible.searchWord": "Rechercher un mot dans la Bible",
  "bible.history": "Historique",
  "bible.prevChapter": "Chapitre précédent",
  "bible.nextChapter": "Chapitre suivant",
  "bible.chapters": "Chapitres",
  "bible.chapterN": "Chapitre {n}",
  "bible.bookChapter": "Livre et chapitre",
  "bible.nav": "Navigation biblique",
  "bible.menu": "Menu",
  "bible.menuBible": "Menu Bible",
  "bible.version": "Version",
  "bible.versionGroup": "Version de la Bible",
  "bible.tools": "Outils",
  "bible.offlineReady": "Bible hors ligne",
  "bible.offlineDownload": "Télécharger hors ligne",
  "bible.offlineDownloading": "Téléchargement… {done}/{total}",
  "bible.offlineBusy":
    "Téléchargement… {done}/{total} (toucher pour annuler)",
  "bible.font": "Police",
  "bible.fontSize": "Taille du texte",
  "bible.fontSmaller": "Réduire la taille du texte",
  "bible.fontLarger": "Augmenter la taille du texte",
  "bible.text": "Texte",
  "bible.planProgress": "Progression du plan",
  "bible.planPrev": "Passage précédent du plan",
  "bible.planNext": "Passage suivant du plan",
  "offline.title": "Chapitre hors ligne indisponible",
  "offline.lead":
    "Ce chapitre doit être téléchargé pour une lecture sans connexion. Vos marques et l’avancement restent enregistrés sur l’appareil.",
  "offline.reconnectTitle": "Connexion requise pour télécharger",
  "offline.reconnectLead":
    "Cette version n’est pas encore disponible hors ligne. Reconnectez-vous pour la télécharger ; ensuite la lecture et la recherche fonctionneront sans réseau.",
  "offline.downloading": "Téléchargement…",
  "offline.waiting": "En attente de connexion",
  "offline.downloadCta": "Télécharger la Bible hors ligne",
  "install.bannerTitle": "Installer Biblos hors ligne",
  "install.bannerLead":
    "Versions bibliques, plans de lecture et références croisées — une seule fois.",
  "install.bannerCta": "Installer",
  "install.bannerBusy": "Installation…",
  "install.phase.s21": "Segond 21 — {done}/{total}",
  "install.phase.ht98": "Kreyòl HT98 — {done}/{total}",
  "install.phase.tske": "Références croisées — {done}/{total}",
  "install.phase.plans": "Plans de lecture…",
  "install.error": "Échec de l’installation. Réessaie avec une connexion.",
  "swUpdate.title": "Nouvelle version",
  "swUpdate.lead": "Une mise à jour est prête à installer.",
  "swUpdate.cta": "Mettre à jour",
  "searchBooks.title": "Livres",
  "searchBooks.back": "Retour aux livres",
  "searchBooks.close": "Fermer",
  "searchBooks.placeholder": "Genèse, Psaumes, Jean…",
  "searchBooks.search": "Rechercher un livre",
  "searchBooks.empty": "Aucun livre",
  "searchBooks.chapters": "Chapitres",
  "searchBooks.chAbbr": "{n} ch.",
  "searchBooks.chaptersCount": "{n} chapitre(s)",
  "study.title": "Étude",
  "study.close": "Fermer l’étude",
  "study.context": "Contexte",
  "study.refs": "Références",
  "study.crossRefs": "Référence croisée",
  "study.application": "Application",
  "study.notes": "Notes",
  "study.tabs": "Sections d’étude",
  "study.notesLabel": "Mes notes",
  "study.contextEmpty": "Contexte historique non disponible pour ce verset.",
  "study.appEmpty": "Application pratique à venir pour ce passage.",
  "study.refsEmpty": "Aucune référence croisée pour ce verset.",
  "study.notesPlaceholder": "Écrire une note personnelle…",
  "study.notesSaved": "Enregistré · sync si connecté",
  "study.notesDraft": "Brouillon local",
  "study.loadError": "Erreur de chargement",
  "study.refUnavailable": "Texte de ce passage indisponible pour cette version.",
  "verse.actions": "Actions du verset",
  "verse.hint": "Tape d’autres versets pour compléter la sélection",
  "verse.hintMulti": "{n} versets · tape pour ajouter ou retirer",
  "verse.mark": "Marquer",
  "verse.unmark": "Démarquer",
  "verse.share": "Partager",
  "verse.shareCopied": "Texte copié",
  "verse.shareFailed": "Partage impossible",
  "verse.colorTitle": "Personnaliser la couleur",
  "word.placeholder": "Mot ou expression…",
  "word.aria": "Rechercher un mot ou une expression dans la Bible",
  "word.panel": "Recherche dans la Bible",
  "word.ot": "Ancien",
  "word.nt": "Nouveau",
  "word.dc": "Deutéro.",
  "word.recents": "RÉCENTS",
  "word.suggestions": "SUGGESTIONS",
  "word.filterBook": "Filtrer un livre…",
  "word.apply": "Appliquer ({n} passages)",
  "word.showAll": "Tout afficher ({n})",
  "word.partial": "{shown} sur {total} passages",
  "word.count": "{n} passage(s)",
  "word.empty": "Aucun passage trouvé",
  "word.fuzzy":
    "Aucun résultat exact. Affichage des passages pour des termes proches.",
  "word.or":
    "Aucun verset avec tous les mots. Passages contenant une partie de votre recherche :",
  "word.unavailable": "Recherche indisponible",
};

const HT: Dict = {
  "shell.nav": "Navigasyon",
  "shell.home": "Akèy",
  "shell.plan": "Plan",
  "shell.bible": "Bib",
  "shell.profile": "Pwofil",
  "common.close": "Fèmen",
  "common.clear": "Efase",
  "common.confirm": "Konfime ?",
  "common.cancel": "Anile",
  "common.reload": "Rechaje",
  "common.error": "Gen yon erè ki rive",
  "common.loading": "Ap chaje…",
  "common.book": "Liv",
  "common.chapters": "Chapit",
  "home.greeting.morning": "Bonjou",
  "home.greeting.afternoon": "Bonswa",
  "home.greeting.evening": "Bonswa",
  "home.continue": "Kontinye lekti",
  "home.openBible": "Louvri Bib la",
  "home.dailyVerse": "Vèsè jodi a",
  "home.share": "Pataje",
  "home.plans": "Plan lekti",
  "home.resumePlan": "Rekòmanse",
  "home.discoverPlans": "Dekouvri plan yo",
  "home.read": "Li →",
  "home.seeAll": "Wè tout",
  "home.days": "{done}/{total} jou",
  "home.plansEmpty": "Chwazi yon parcours nan onglet Plan la.",
  "home.browsePlans": "Gade plan yo",
  "plan.title": "Plan",
  "plan.discover": "Dekouvri",
  "plan.empty": "Pa gen plan disponib",
  "plan.resume": "Rekòmanse",
  "plan.start": "Kòmanse",
  "plan.inProgress": "An kou",
  "plan.all": "Tout plan yo",
  "plan.emptyHint": "Parcours gide yo ap parèt isit lè yo pibliye.",
  "plan.catalogError": "Katalòg pa disponib",
  "plan.catalogErrorHint": "Pa kapab chaje plan yo pou kounye a.",
  "plan.offline": "Plan offline",
  "plan.offlineHint":
    "Katalòg la pa konfigire sou aparèy sa a. Ou ka toujou louvri Bib la.",
  "profile.title": "Pwofil",
  "profile.history": "Istorik",
  "profile.clearHistory": "Efase",
  "profile.clearHistoryConfirm": "Konfime ?",
  "profile.signIn": "Konekte",
  "profile.signOut": "Dekonekte",
  "profile.connectAccount": "Konekte yon kont",
  "profile.tab.account": "Kont",
  "profile.tab.prefs": "Preferans",
  "profile.tab.storage": "Depo",
  "profile.tab.history": "Istorik",
  "profile.tab.admin": "Admin",
  "profile.account": "Kont",
  "auth.titleUpgrade": "Sove etid mwen yo",
  "auth.titleSoftGate": "Kenbe souliyman ou yo",
  "auth.leadUpgrade":
    "Konekte ak Google pou senkwonize mak, nòt ak plan ant aparèy ou yo.",
  "auth.leadSoftGate":
    "An mòd envite, ou ka make jiska 10 vèsè sou aparèy sa a. Konekte Google pou kontinye epi jwenn souliyman ou yo tout kote.",
  "auth.google": "Kontinye ak Google",
  "auth.or": "oswa",
  "auth.email": "Imèl",
  "auth.password": "Modpas",
  "auth.signIn": "Konekte",
  "auth.register": "Kreye yon kont",
  "auth.sendLink": "Voye lyen an",
  "auth.createAccount": "Kreye yon kont",
  "auth.forgotPassword": "Modpas bliye ?",
  "auth.backToSignIn": "Retounen nan koneksyon",
  "auth.later": "Pita",
  "auth.resetSent":
    "Imèl reyinisyalizasyon voye. Tcheke bwat resepsyon ou.",
  "auth.errorEmail": "Antre imèl ou.",
  "auth.errorPassword": "Modpas : omwen 6 karaktè.",
  "auth.showPassword": "Montre modpas la",
  "auth.hidePassword": "Kache modpas la",
  "auth.error.generic": "Koneksyon pa posib. Eseye ankò nan yon ti moman.",
  "auth.error.invalidCredential": "Imèl oswa modpas pa kòrèk.",
  "auth.error.wrongPassword": "Modpas pa kòrèk.",
  "auth.error.userNotFound": "Pa gen kont pou imèl sa a.",
  "auth.error.emailInUse": "Imèl sa a deja mare ak yon kont.",
  "auth.error.weakPassword":
    "Modpas twò fèb (omwen 6 karaktè).",
  "auth.error.tooManyRequests":
    "Twòp esè. Eseye ankò pita.",
  "auth.error.network": "Rezo pa disponib. Verifye koneksyon ou.",
  "auth.error.popupClosed": "Koneksyon anile.",
  "auth.signOutConfirm":
    "Done senkwonize yo rete an sekirite nan nwaj la epi y ap tounen nan pwochen koneksyon. Y ap retire nan aparèy sa a.",
  "auth.signOutConfirmOffline":
    "Ou offline: modifikasyon ki poko voye yo ka pèdi.",
  "auth.signOutConfirmAction": "Dekonekte nan aparèy sa a",
  "onboarding.welcomeTitle": "Byenveni",
  "onboarding.welcomeLead":
    "Konfime oswa ajiste non ou. Kont ou senkwonize done yo ant aparèy.",
  "onboarding.fullName": "Non konplè",
  "onboarding.errorName": "Antre non konplè ou pou kontinye.",
  "onboarding.submit": "Kontinye",
  "onboarding.cancel": "Anile",
  "toast.offline": "Offline — tout rete anrejistre sou aparèy sa a.",
  "toast.markSaved": "Souliyman anrejistre",
  "profile.theme": "Tèm",
  "profile.settings": "Preferans",
  "profile.appearance": "Aparans",
  "profile.language": "Lang",
  "profile.langFr": "Français",
  "profile.langHt": "Kreyòl",
  "profile.themeLight": "Klè",
  "profile.themeDark": "Fènwa",
  "profile.storage": "Depo",
  "profile.download": "Telechaje",
  "profile.ready": "Pare",
  "profile.historyEmpty": "Pa gen lekti anrejistre pou kounye a.",
  "profile.marks": "Souliyman",
  "profile.marksEmpty": "Pa gen vèsè souliye pou kounye a.",
  "profile.calculating": "Ap kalkile…",
  "history.title": "Istorik",
  "history.empty": "Pa gen lekti anrejistre pou kounye a.",
  "history.recent": "Chapit ki louvri dènyèman",
  "history.clearAll": "Efase tout",
  "history.clearAllConfirm": "Efase tout istorik lekti a ?",
  "history.delete": "Efase",
  "history.close": "Fèmen istorik la",
  "history.count": "{n} lekti",
  "history.countOne": "{n} lekti",
  "bible.searchWord": "Chèche yon mo nan Bib la",
  "bible.history": "Istorik",
  "bible.prevChapter": "Chapit anvan",
  "bible.nextChapter": "Chapit apre",
  "bible.chapters": "Chapit",
  "bible.chapterN": "Chapit {n}",
  "bible.bookChapter": "Liv ak chapit",
  "bible.nav": "Navigasyon biblik",
  "bible.menu": "Meni",
  "bible.menuBible": "Meni Bib",
  "bible.version": "Vèsyon",
  "bible.versionGroup": "Vèsyon Bib la",
  "bible.tools": "Zouti",
  "bible.offlineReady": "Bib offline",
  "bible.offlineDownload": "Telechaje offline",
  "bible.offlineDownloading": "Ap telechaje… {done}/{total}",
  "bible.offlineBusy":
    "Ap telechaje… {done}/{total} (touché pou anile)",
  "bible.font": "Font",
  "bible.fontSize": "Gwosè tèks",
  "bible.fontSmaller": "Redwi gwosè tèks la",
  "bible.fontLarger": "Ogmante gwosè tèks la",
  "bible.text": "Tèks",
  "bible.planProgress": "Pwogrè plan an",
  "bible.planPrev": "Pasaj anvan nan plan an",
  "bible.planNext": "Pasaj apre nan plan an",
  "offline.title": "Chapit offline pa disponib",
  "offline.lead":
    "Chapit sa a dwe telechaje pou lekti san koneksyon. Mak ou yo ak pwogrè a rete sou aparèy la.",
  "offline.reconnectTitle": "Koneksyon nesesè pou telechaje",
  "offline.reconnectLead":
    "Vèsyon sa a poko disponib offline. Rekonekte pou telechaje li ; apre sa lekti ak rechèch ap mache san rezo.",
  "offline.downloading": "Ap telechaje…",
  "offline.waiting": "Ap tann koneksyon",
  "offline.downloadCta": "Telechaje Bib la offline",
  "install.bannerTitle": "Enstale Biblos offline",
  "install.bannerLead":
    "Vèsyon Bib, plan lekti ak referans kwa — yon sèl fwa.",
  "install.bannerCta": "Enstale",
  "install.bannerBusy": "Ap enstale…",
  "install.phase.s21": "Segond 21 — {done}/{total}",
  "install.phase.ht98": "Kreyòl HT98 — {done}/{total}",
  "install.phase.tske": "Referans kwa — {done}/{total}",
  "install.phase.plans": "Plan lekti…",
  "install.error": "Enstalasyon echwe. Eseye ankò ak yon koneksyon.",
  "swUpdate.title": "Nouvo vèsyon",
  "swUpdate.lead": "Gen yon mizajou pare pou enstale.",
  "swUpdate.cta": "Mete ajou",
  "searchBooks.title": "Liv",
  "searchBooks.back": "Tounen nan liv yo",
  "searchBooks.close": "Fèmen",
  "searchBooks.placeholder": "Jenèz, Sòm, Jan…",
  "searchBooks.search": "Chèche yon liv",
  "searchBooks.empty": "Pa gen liv",
  "searchBooks.chapters": "Chapit",
  "searchBooks.chAbbr": "{n} ch.",
  "searchBooks.chaptersCount": "{n} chapit",
  "study.title": "Etid",
  "study.close": "Fèmen etid la",
  "study.context": "Kontèks",
  "study.refs": "Referans",
  "study.crossRefs": "Referans kwa",
  "study.application": "Aplikasyon",
  "study.notes": "Nòt",
  "study.tabs": "Seksyon etid",
  "study.notesLabel": "Nòt mwen",
  "study.contextEmpty": "Kontèks istorik pa disponib pou vèsè sa a.",
  "study.appEmpty": "Aplikasyon pratik ap vini pou pasaj sa a.",
  "study.refsEmpty": "Pa gen referans kwa pou vèsè sa a.",
  "study.notesPlaceholder": "Ekri yon nòt pèsonèl…",
  "study.notesSaved": "Anrejistre · sync si konekte",
  "study.notesDraft": "Brouiyon lokal",
  "study.loadError": "Erè chajman",
  "study.refUnavailable": "Tèks pasaj sa a pa disponib pou vèsyon sa a.",
  "verse.actions": "Aksyon vèsè",
  "verse.hint": "Tape lòt vèsè pou konplete seleksyon an",
  "verse.hintMulti": "{n} vèsè · tape pou ajoute oswa retire",
  "verse.mark": "Make",
  "verse.unmark": "Demake",
  "verse.share": "Pataje",
  "verse.shareCopied": "Tèks kopye",
  "verse.shareFailed": "Pataj pa posib",
  "verse.colorTitle": "Personnalize koulè a",
  "word.placeholder": "Chèche nan Bib la…",
  "word.aria": "Chèche yon mo oswa yon ekspresyon nan Bib la",
  "word.panel": "Rechèch nan Bib la",
  "word.ot": "Ansyen",
  "word.nt": "Nouvo",
  "word.dc": "Dewoterokanonik",
  "word.recents": "RESAN",
  "word.suggestions": "SIJESYON",
  "word.filterBook": "Filtre yon liv…",
  "word.apply": "Aplike ({n} pasaj)",
  "word.showAll": "Montre tout ({n})",
  "word.partial": "{shown} sou {total} pasaj",
  "word.count": "{n} pasaj",
  "word.empty": "Pa gen pasaj jwenn",
  "word.fuzzy":
    "Pa gen rezilta egzak. Nou montre pasaj pou mo ki sanble.",
  "word.or":
    "Pa gen vèsè ak tout mo yo. Pasaj ki gen yon pati nan rechèch ou a:",
  "word.unavailable": "Rechèch pa disponib",
};

const TABLES: Record<UiLocale, Dict> = { fr: FR, ht: HT };

export function uiCopy(locale: UiLocale): Dict {
  return TABLES[locale] ?? FR;
}

export function formatUiCopy(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(vars[key] ?? `{${key}}`),
  );
}

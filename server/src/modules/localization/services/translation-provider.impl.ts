import { TranslationProvider } from "./translation-provider.interface.js";
import translatte from "translatte";

export class MockTranslationProvider implements TranslationProvider {
  private dictionaries: Record<string, Record<string, string>> = {
    si: {
      "welcome to talnova": "Talnova වෙත සාදරයෙන් පිළිගනිමු",
      "welcome to talnova onboarding": "Talnova Onboarding වෙත සාදරයෙන් පිළිගනිමු",
      "introduction": "හැඳින්වීම",
      "module 1": "පළමු මොඩියුලය",
      "employee onboarding": "සේවක බඳවා ගැනීම",
      "company policies": "සමාගම් ප්‍රතිපත්ති",
      "code of conduct": "චර්යාධර්ම පද්ධතිය",
      "security and compliance": "ආරක්ෂාව සහ අනුකූලතාවය",
      "quiz": "ප්‍රශ්නාවලිය",
      "lesson": "පාඩම",
      "complete": "සම්පූර්ණයි",
      "next": "ඊළඟ",
      "previous": "පෙර",
      "submit": "ඉදිරිපත් කරන්න",
      "congratulations!": "සුභ පැතුම්!",
      "onboarding journey": "දිශානති ගමන",
      "curriculum": "විෂය මාලාව",
      "assignments": "පැවරුම්",
      "general onboarding": "පොදු දිශානතිය",
      "finish": "අවසන් කරන්න",
      "save changes": "වෙනස්කම් සුරකින්න",
      "cancel": "අවලංගු කරන්න",
      "loading": "පූරණය වෙමින් පවතී",
      "error": "දෝෂයකි",
      "mark as completed": "සම්පූර්ණ ලෙස සලකුණු කරන්න",
      "completed": "සම්පූර්ණයි",
      "this lesson will complete automatically when you watch 90% of the video / listen to 90% of the audio.": "ඔබ වීඩියෝවෙන් 90% ක් නැරඹූ විට හෝ ඕඩියෝවෙන් 90% ක් ශ්‍රවණය කළ විට මෙම පාඩම ස්වයංක්‍රීයව සම්පූර්ණ වේ.",
      "lesson assessment": "පාඩම් ඇගයීම",
      "answer the questions below to verify your learning. you need at least": "ඔබේ ඉගෙනීම තහවුරු කිරීම සඳහා පහත ප්‍රශ්නවලට පිළිතුරු සපයන්න. ඔබට අවම වශයෙන්",
      "to pass.": "අවශ්‍ය වේ.",
      "submit assessment": "ඇගයීම ඉදිරිපත් කරන්න",
      "quiz evaluation results": "ප්‍රශ්නාවලි ඇගයීමේ ප්‍රතිඵල",
      "excellent work! you passed the assessment requirements.": "විශිෂ්ට කාර්යයක්! ඔබ ඇගයීමේ අවශ්‍යතා සමත් විය.",
      "you did not score enough to pass the assessment this time.": "මෙවර ඇගයීම සමත් වීමට ඔබට ප්‍රමාණවත් ලකුණු ලැබී නැත.",
      "your score": "ඔබේ ලකුණු",
      "passing score": "සමත් වීමේ ලකුණු",
      "attempt no": "උත්සාහ අංකය",
      "retake quiz": "නැවත ප්‍රශ්නාවලිය කරන්න",
      "try again": "නැවත උත්සාහ කරන්න"
    },
    ta: {
      "welcome to talnova": "Talnova-விற்கு உங்களை வரவேற்கிறோம்",
      "welcome to talnova onboarding": "Talnova Onboarding-விற்கு உங்களை வரவேற்கிறோம்",
      "introduction": "அறிமுகம்",
      "module 1": "தொகுதி 1",
      "employee onboarding": "ஊழியர் உள்வாங்கல்",
      "company policies": "நிறுவனத்தின் கொள்கைகள்",
      "code of conduct": "நடத்தை விதிமுறை",
      "security and compliance": "பாதுகாப்பு மற்றும் இணக்கம்",
      "quiz": "விடைவினா",
      "lesson": "பாடம்",
      "complete": "நிறைவு",
      "next": "அடுத்து",
      "previous": "முந்தைய",
      "submit": "சமர்ப்பிக்கவும்",
      "congratulations!": "வாழ்த்துகள்!",
      "onboarding journey": "உள்வாங்கல் பயணம்",
      "curriculum": "கலைத்திட்டம்",
      "assignments": "பணிகள்",
      "general onboarding": "பொதுவான உள்வாங்கல்",
      "finish": "முடி",
      "save changes": "மாற்றங்களைச் சேமிக்கவும்",
      "cancel": "ரத்துசெய்",
      "loading": "ஏற்றப்படுகிறது",
      "error": "பிழை",
      "mark as completed": "முடிவடைந்ததாகக் குறிக்கவும்",
      "completed": "முடிவடைந்தது",
      "this lesson will complete automatically when you watch 90% of the video / listen to 90% of the audio.": "நீங்கள் 90% வீடியோவைப் பார்க்கும்போது அல்லது 90% ஆடியோவைக் கேட்கும்போது இந்த பாடம் தானாகவே நிறைவடையும்.",
      "lesson assessment": "பாட மதிப்பீடு",
      "answer the questions below to verify your learning. you need at least": "உங்கள் கற்றலைச் சரிபார்க்க கீழே உள்ள கேள்விகளுக்குப் பதிலளிக்கவும். உங்களுக்கு குறைந்தபட்சம்",
      "to pass.": "தேர்ச்சி பெற தேவை.",
      "submit assessment": "மதிப்பீட்டைச் சமர்ப்பிக்கவும்",
      "quiz evaluation results": "வினாடி வினா மதிப்பீட்டு முடிவுகள்",
      "excellent work! you passed the assessment requirements.": "சிறந்த வேலை! நீங்கள் மதிப்பீட்டுத் தேவைகளில் தேர்ச்சி பெற்றுள்ளீர்கள்.",
      "you did not score enough to pass the assessment this time.": "இந்த முறை நீங்கள் தேர்ச்சி பெற போதுமான மதிப்பெண் பெறவில்லை.",
      "your score": "உமது மதிப்பெண்",
      "passing score": "தேர்ச்சி மதிப்பெண்",
      "attempt no": "முயற்சி எண்",
      "retake quiz": "வினாடி வினாவை மீண்டும் செய்யவும்",
      "try again": "மீண்டும் முயற்சிக்கவும்"
    }
  };

  async translate(text: string, from: string, to: string): Promise<string> {
    if (!text) return "";
    const targetDict = this.dictionaries[to];
    const cleanText = text.trim().toLowerCase();
    
    // Check direct dictionary first (for exact matches / fast performance / override control)
    if (targetDict && targetDict[cleanText]) {
      return targetDict[cleanText];
    }

    try {
      const res = await translatte(text, { from: "en", to });
      return res.text;
    } catch (err) {
      // Fallback if the Google Translate web API times out or rate limits
      if (targetDict) {
        // Try finding dictionary entries in text as whole words
        let translated = text;
        let didTranslate = false;
        for (const [key, value] of Object.entries(targetDict)) {
          const regex = new RegExp(`\\b${key}\\b`, "gi");
          if (regex.test(translated)) {
            translated = translated.replace(regex, value);
            didTranslate = true;
          }
        }
        if (didTranslate) {
          return translated;
        }
      }
      const prefix = to === "si" ? "[සිංහල] " : "[தமிழ்] ";
      return `${prefix}${text}`;
    }
  }

  async detectLanguage(text: string): Promise<string> {
    return "en";
  }

  async batchTranslate(
    items: Array<{ text: string; field?: string }>,
    from: string,
    to: string
  ): Promise<string[]> {
    return Promise.all(items.map(item => this.translate(item.text, from, to)));
  }
}

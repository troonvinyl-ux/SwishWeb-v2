import type { CaptureSlot } from '@/types/capture';
import type { MusicValues } from '@/types/music';
export const MUSIC_SOURCE_COMMIT = '08af3947840d119f4813965784953fd77ce2a53a';
export const MUSIC_GRADES = [['M','Mint'],['NM','Near Mint'],['VG+','VG+'],['VG','VG'],['G+','G+'],['G','Good'],['P','Poor']] as const;
export const MUSIC_DEFAULTS: MusicValues = { artist:'',release_title:'',format:'Vinyl',barcode:'',catalogue_number:'',label:'',year:'',country:'',matrix_runout:'',media_grade:'',sleeve_grade:'',condition_notes:'',edition:'',record_size:'',speed:'',observed_disc_count:'',genre:'',style:'',rights_society:'',label_code:'',features:'',title:'',description:'',price:'',location:'',play_tested:false,reviewed:false,pressing_reviewed:false };
export const MUSIC_EDIT_FIELDS = [
 ['artist','Artist'],['release_title','Release title'],['format','Format'],['barcode','UPC / EAN barcode'],['catalogue_number','Catalogue number'],['label','Record label'],['year','Release year'],['country','Release country'],['matrix_runout','Visible matrices / runouts'],['edition','Pressing / edition'],['record_size','Record size'],['speed','Speed'],['observed_disc_count','Discs physically present'],['genre','Genre'],['style','Style'],['rights_society','Rights society'],['label_code','Label code'],['features','Special features / inserts'],['condition_notes','Visible condition / missing parts'],['location','Storage location'],
] as const;
export function musicPhotoSlots(format = 'Vinyl'): CaptureSlot[] {
 const cd=/CD|DVD|Blu-ray/i.test(format), tape=/cassette/i.test(format), box=/box/i.test(format);
 const entries = [
 ['front_sleeve',box?'Front cover / box':'Front cover','Show the complete artist, release title and artwork.'],
 ['back_sleeve','Rear cover','Show tracklisting, label, catalogue number, dates and country.'],
 ['barcode','Barcode','Fill the frame with the printed UPC / EAN; avoid glare.'],
 ['spine','Spine / catalogue number','Read the artist, title, label and exact catalogue number.'],
 ['label_a',cd?'Disc 1 label':tape?'Cassette Side A':'Record label Side A','Show all printed text, logos and identifiers.'],
 ['label_b',cd?'Additional disc label':tape?'Cassette Side B':'Record label Side B','Show matching release identifiers and disc numbering.'],
 ['matrix_a',cd?'Disc hub / matrix':tape?'Shell / moulded identifiers':'Runout / matrix Side A','Use raking light; transcribe only genuinely readable marks.'],
 ['matrix_b',cd?'Additional disc hub':tape?'Reverse shell identifiers':'Runout / matrix Side B','Show the second matrix, plant or mastering marks where present.'],
 ['inner_sleeve',cd?'Booklet':tape?'J-card insert':'Inner sleeve / inserts','Show printed details, inserts and edition evidence.'],
 ['identifiers','Additional printed identifiers','Dates, label codes, country, rights societies or stickers.'],
 ['edition','Edition-specific details','Coloured vinyl, picture discs, promo marks or unusual packaging.'],
 ['condition','Condition / contents','Show damage, wear, scratches, missing components and all discs.'],
 ];
 return entries.map(([id,label,description])=>({id,label,description,required:false}));
}

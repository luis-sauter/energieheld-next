-- Register existing, hash-verified repository banner originals. No files or campaigns are changed.
WITH originals(path,name,source,hash) AS (VALUES
('/images/legacy-ads/annis-romantikhaeuschen.jpg','annis romantikhaeuschen','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','53cf6dbe6c07ea3347cb853e840a1df44e72eaf5ad4428e3e541b969e5491ffa'),
('/images/legacy-ads/barfusspark.jpg','barfusspark','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','09658a3d7403ff96eefdc1e21ede024ddaeda29d0bdf6b1aff8fb9a5b88d7870'),
('/images/legacy-ads/city-apart-square.jpg','city apart square','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','4d5edfc897761039fb8bcf820e79d2924d3b474b3ad441cf4093d0c8b383d968'),
('/images/legacy-ads/city-apart-wide.jpg','city apart wide','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','0348797d554e5e602592c48ca517fe9d9e2b4c66860ed42f81aaf93522344b93'),
('/images/legacy-ads/ferienanlage-nationalpark.jpg','ferienanlage nationalpark','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','45d1ed43bc8fc16813bbd3a974d940126bae6de34f5e9b92bca28cbafd762653'),
('/images/legacy-ads/ferienbauernhof-buechele.jpg','ferienbauernhof buechele','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','8574e112f225cfef481549670214763c9701e1d82d37d2fbbf2faafc79c85080'),
('/images/legacy-ads/fewo-sieber.jpg','fewo sieber','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','6b8ece86c597d5ca379827d1869d2a4e04ed8a543acb065406b1f68f8a8da9e8'),
('/images/legacy-ads/haus-salzburg.jpg','haus salzburg','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','c91ec231d891c05ddaf06b55d14931ffa5d950ce760220a138686ad2d2a81afb'),
('/images/legacy-ads/neue-schaenke.jpg','neue schaenke','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','7dacf395d083864fdea3520a1fadc71df87188bc823e10a0874851425284e213'),
('/images/legacy-ads/reconciled/235.jpg','235','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','f5e6963445a34987e920a766cf69692294902aa34751a789619bbd80bffc2805'),
('/images/legacy-ads/reconciled/358.jpg','358','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','53cf6dbe6c07ea3347cb853e840a1df44e72eaf5ad4428e3e541b969e5491ffa'),
('/images/legacy-ads/reconciled/367.jpg','367','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','cf00dd3d58ea3b4c46e99af1c9ab6f25ee51a23d96ed370091afc1b0f026f421'),
('/images/legacy-ads/reconciled/368.jpg','368','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','5ccef5558f3506596303b3b572510ad60918dfa035f50d9934f26cd8b764ee66'),
('/images/legacy-ads/reconciled/369.jpg','369','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','4d5edfc897761039fb8bcf820e79d2924d3b474b3ad441cf4093d0c8b383d968'),
('/images/legacy-ads/reconciled/371.jpg','371','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','18b655aa7c8e6509e2392cb26124689eb08cd16cfb94d582b2e950fac870d3da'),
('/images/legacy-ads/reconciled/374.jpg','374','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','eb529ef6615749075ff8227648119e8eb24828ae0f561a5b42e1d0a0d8c1df25'),
('/images/legacy-ads/reconciled/375.jpg','375','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','63964d59d1f431774a533514e7fa189bcb2c2e832413c427799aba34c3b8bc2e'),
('/images/legacy-ads/reconciled/383.jpg','383','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','fd1585cf3438417d8d179d092b4a7950829ea797106d0f7e1244035c77292f86'),
('/images/legacy-ads/reconciled/387.jpg','387','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','09658a3d7403ff96eefdc1e21ede024ddaeda29d0bdf6b1aff8fb9a5b88d7870'),
('/images/legacy-ads/reconciled/389.jpg','389','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','3bf3b9f40bc5b48d5bb6d1c4897db7e5f333b856141c1a208835b56e2cd9314e'),
('/images/legacy-ads/reconciled/391.jpg','391','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','f09c4b0f8667fd301673669d9a4ae570b9f683036256d033c72d2563c5bf593f'),
('/images/legacy-ads/reconciled/397.jpg','397','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','8574e112f225cfef481549670214763c9701e1d82d37d2fbbf2faafc79c85080'),
('/images/legacy-ads/reconciled/400.jpg','400','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','10857589cb3f11b0ef30c9cc3356abfdd85dcb5acf7e80f35bdb72d01dd51617'),
('/images/legacy-ads/reconciled/402.jpg','402','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','7a00d9b4e12ad217886f2ca6bb439e1625a8a2f6f274bc87ad371070faf7067f'),
('/images/legacy-ads/reconciled/404.jpg','404','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','f14be0578fa73cd89d425fc8ad29ed5fe8f53f6f67fbefd4c530c57c8104da09'),
('/images/legacy-ads/reconciled/406.jpg','406','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','6cd4231003ecc904689bbc5f06a2ee6cdbf8b1eb7daa0b70e4ea57f04737441a'),
('/images/legacy-ads/reconciled/407.jpg','407','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','8acb7731d265f09977c6e7d6a5b08b6549733b5be4729b746b129bf33e9c3cbf'),
('/images/legacy-ads/reconciled/408.jpg','408','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','5e3ae221bdfd47a3cd91ac860441bd434e606306a4d4c3e5646cb0b006f4cead'),
('/images/legacy-ads/reconciled/414.jpg','414','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','c7e14759f5cc93f422de1476eaad45cc53465c896db898bfbd288e66d916c9cb'),
('/images/legacy-ads/reconciled/418.jpg','418','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','394f94a5457f44f0ab8dc74d70ac2f88edc2ba9e4343e592e52d0953ea2c8f02'),
('/images/legacy-ads/reconciled/422.jpg','422','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','377e888f1a5ec802aa3fe76cd7aefc0cee336bcf998e458ba0ca921bb394b3e4'),
('/images/legacy-ads/reconciled/424.jpg','424','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','7d99fb3e39c3ba2e653639789dbb6f752edc60aca1b9d319e73acb5351bda0e9'),
('/images/legacy-ads/reconciled/426.jpg','426','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','ce2a4a2aa99bc8a562c73d625e2a09d8b32d05218ad6c9b05fad852bd4d09a1c'),
('/images/legacy-ads/reconciled/428.jpg','428','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','01a1b6be004a5477fb04ad3bfae2f199ee630fef4c97d462eeaa5be097a0d7ce'),
('/images/legacy-ads/reconciled/429.jpg','429','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','07ee46c3927590b5f5f0f9d9c8c13297a20cc76c14bcb84f0b22bf25455d995e'),
('/images/legacy-ads/reconciled/430.jpg','430','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','76083343aef61422fdd87ba249be7b5ef98e3dd44194444bd8c84a7d4be5caf2'),
('/images/legacy-ads/reconciled/432.jpg','432','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','d98080c0d3061ccbdd1c0828bc902e22d55486eb9dce1f6381b33215d62c5cde'),
('/images/legacy-ads/reconciled/434.jpg','434','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','ea32943ecc30deaa7b5476e3893e53f522feca102d0ab14b4ce82cf3f6a2d12e'),
('/images/legacy-ads/reconciled/436.jpg','436','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','049460d4383f3c7409d1b7082c3d681564d1340175a7ace432a90d0f17679335'),
('/images/legacy-ads/reconciled/438.jpg','438','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','51232c6bea5062bd2ee304232af41667d0b8174a68ff633fa313d02de7ef0d22'),
('/images/legacy-ads/reconciled/440.jpg','440','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','bcd77d16bd3441ca5108562056899383701e6e6770bd446bed311cb7bd6af777'),
('/images/legacy-ads/reconciled/444.jpg','444','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','4ec9db6731ff74f845294f81ca889b634cff8e7d8cae31e9321e319b82d4719c'),
('/images/legacy-ads/reconciled/452.jpg','452','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','412a8ebae7722018ea7f0e3865c49bd8794561eba8144a480052d78f8112ba51'),
('/images/legacy-ads/reconciled/454.jpg','454','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','5bebcae8b1d9b068e01380d6d676a257e0e82a99a1a8856b054003b56792831f'),
('/images/legacy-ads/reconciled/456.jpg','456','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','539a3bebf2d3185dcf91807960627a2f7b7108440275594434741ddfdbd4ffde'),
('/images/legacy-ads/reconciled/458.jpg','458','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','5b2511167ad29d884921e39d4cfee94c40e4a5d9162a62f5bf564759a1301b72'),
('/images/legacy-ads/reconciled/460.jpg','460','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','8239ef5a77911ed684a18568cf8eadc29e9352d8ea027dff65a7ae747bc7194f'),
('/images/legacy-ads/reconciled/462.jpg','462','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','16c6ac85f56358906c73c7bc1255c787975303bf46ccb956ad38f0a3391af0f1'),
('/images/legacy-ads/reconciled/464.jpg','464','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','06486de0090647257441fd93a3c95e99c1a32f7c5ea638e33d4a6648f75f53ba'),
('/images/legacy-ads/reconciled/466.jpg','466','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','808599fc60f9652f1290ced5097baa9808976210245226e8bf52f9289dadc274'),
('/images/legacy-ads/reconciled/471.jpg','471','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','ca92818d90977c2b021781f9a42dda2c331e044e28521a54f113d19abf1adb72'),
('/images/legacy-ads/reconciled/475.jpg','475','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','ce971b556ae870610f5ab8cf8289a1d38a230ca9a9570acc10c07e0aa8ee3de8'),
('/images/legacy-ads/reconciled/480.jpg','480','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','4c73e85c9d24a14a4a785573548fd4accf1567beece09972f9194954c232855f'),
('/images/legacy-ads/reconciled/488.jpg','488','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','c8e0fe52318cad88f04f72584347236d6ece4a1f4ce46d3e09b2a07a5c75b792'),
('/images/legacy-ads/reconciled/489.jpg','489','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','c8e0fe52318cad88f04f72584347236d6ece4a1f4ce46d3e09b2a07a5c75b792'),
('/images/legacy-ads/reconciled/490.jpg','490','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','f88d4b6a2336e3dac3a6b465eda441c75a9d0b907fb9e68dcaec0a9e3fc65455'),
('/images/legacy-ads/reconciled/491.jpg','491','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','c8e0fe52318cad88f04f72584347236d6ece4a1f4ce46d3e09b2a07a5c75b792'),
('/images/legacy-ads/reconciled/495.jpg','495','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','fd849a25f6c5a238a381d680fbf1f0450cc046da801b9a8351ea3e8516155fb2'),
('/images/legacy-ads/reconciled/498.jpg','498','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','3c2a2e7cf075799e14f8a37f9eabea7edb1e55b51016f1c92bf0803989c10849'),
('/images/legacy-ads/reconciled/502.jpg','502','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','1ad64d4c57a45a21cde004eb0be3cd1d4ed4498a0426ac10ae440362e56f4cee'),
('/images/legacy-ads/reconciled/508.jpg','508','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','2828760a5eef7ede3e3ec243529da583256d39251b59db27dec8d91239e9afc8'),
('/images/legacy-ads/reconciled/509.jpg','509','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','f17e1d8231be05e8e26688a90efdfc18085e90308ff387e07a016850dbf981fe'),
('/images/legacy-ads/reconciled/515.jpg','515','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','32044fd8d1a4ab4bee515c982824f9fe2554815dae0f2ab1bf3a4f7c200339c9'),
('/images/legacy-ads/reconciled/520.jpg','520','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','ae03212899dbce219fa8a84a7ddab02126e10bfb0703acc121c62a5bb19fe692'),
('/images/legacy-ads/reconciled/525.jpg','525','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','9cbe7ed3fe1a258e0fdc2182ab8c760f8499a0f55201a05603b41ac30972fcbc'),
('/images/legacy-ads/reconciled/533.jpg','533','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','617fef6a5ce6ee0fa77736c819603565e6852ebb8bb7384af0e48c59f72d0a25'),
('/images/legacy-ads/reconciled/534.jpg','534','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','6a9322acd3b5f2fd85d21f280bbbeb09af3b20671db608148a45065e3afa961b'),
('/images/legacy-ads/reconciled/535.jpg','535','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','6a9322acd3b5f2fd85d21f280bbbeb09af3b20671db608148a45065e3afa961b'),
('/images/legacy-ads/reconciled/536.jpg','536','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','6a9322acd3b5f2fd85d21f280bbbeb09af3b20671db608148a45065e3afa961b'),
('/images/legacy-ads/reconciled/538.jpg','538','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','a7807778d6381f00dc70805f3da8496a49ae71401c2271c312358e28b691c5a4'),
('/images/legacy-ads/reconciled/539.jpg','539','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','683396065907271618cf8929ff56d516e138636895321cb01ed4f6739fb8ff5c'),
('/images/legacy-ads/reconciled/543.jpg','543','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','620e25fcc691dd57a5a4e69633f4eaed05fa4f1bc45acff86bfe5ca58f7e6111'),
('/images/legacy-ads/reconciled/545.jpg','545','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','ffddf27181fdd0dffd86eeefd5107402ff5c1872bbe60cd2520ecb0efdf3b886'),
('/images/legacy-ads/reconciled/546.jpg','546','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','18a2074fd8e5139a137b0784bcc2cff290f9885a9272568920e11add93a8e761'),
('/images/legacy-ads/reconciled/556.jpg','556','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','a238eefe2811bfdc625137176401409e0118eb0e5c1adbf19c99b2287661e838'),
('/images/legacy-ads/reconciled/562.jpg','562','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','b6708bd86e59192053c94114f86c7b194e6c82f6b719570267dae56cfb249e7d'),
('/images/legacy-ads/reconciled/568.jpg','568','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','aecb2bb531fcc6fd9cd2272989b833630232640e7fc5ae4892c5a9c69d93dbd5'),
('/images/legacy-ads/reconciled/572.jpg','572','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','b1215542fb2d3f9404ed0f37f0e37c217cfb19df5f8c6fb1a34c8198b9fd6446'),
('/images/legacy-ads/reconciled/576.jpg','576','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','ac3cacaece388b56131fcfabb846389df99a3d7b38af77a5e042ac1d27d2c502'),
('/images/legacy-ads/reconciled/578.jpg','578','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','eac2ea04b48476be87c66a4caeadabe451759b2ba297a0548106248c90f3b1fd'),
('/images/legacy-ads/reconciled/579.jpg','579','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','eac2ea04b48476be87c66a4caeadabe451759b2ba297a0548106248c90f3b1fd'),
('/images/legacy-ads/reconciled/584.jpg','584','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','6a293eeda31294bfbcdfeefa860e8db8f9c974bc1f3060dd4b83a6b6ad623114'),
('/images/legacy-ads/reconciled/587.jpg','587','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','78782b7f795930d056bc126d9a86ce038773be0fd5cb42f3dff26994328eae99'),
('/images/legacy-ads/reconciled/589.jpg','589','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','0b79042672a0527c5eddfe6a156f53f5211e8abf0dda7832aa7d5da6b1d3cff5'),
('/images/legacy-ads/reconciled/592.jpg','592','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','eefe7933e2768d15c87105e958f6a100f2f4c1f66844d09b8f7720ece79ee291'),
('/images/legacy-ads/reconciled/596.jpg','596','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','237c2fead55fd906f2a621722f1bf39cb753cca4361f6d30b9d8db2614994a47'),
('/images/legacy-ads/reconciled/603.jpg','603','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','d0a192cda5cab42dfb744c5cfd7051ae39bc76b56007c8a79999e745d3c4cf2e'),
('/images/legacy-ads/reconciled/606.jpg','606','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','7934d5aa6494a2d315546e7878d6a3dbd4ce044d3c80d5f92096eef3e8dac2f5'),
('/images/legacy-ads/reconciled/608.jpg','608','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','4a64cc49a295edec332beaa64a307a574837e1daf40618caa7d01dd5f69101ff'),
('/images/legacy-ads/reconciled/610.jpg','610','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','40c5cff83ec3ba6b1739d3e90fc4a5b7a9c5e18d2cdbe83d0bf6555db9a58df0'),
('/images/legacy-ads/reconciled/612.jpg','612','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','b763a9070c648928ccd253dbb09a1d94dac49c83e2725fc6edd8089b314e2fca'),
('/images/legacy-ads/reconciled/614.jpg','614','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','401967d02c5664ef4e7f6124ef4fe5809044a36d26a018ca523064799aafa3eb'),
('/images/legacy-ads/reconciled/615.jpg','615','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','83f4594922fd67fb3fa036477670fbba627b1e1241a33120fa0c93562742d710'),
('/images/legacy-ads/reconciled/639.jpg','639','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','7dacf395d083864fdea3520a1fadc71df87188bc823e10a0874851425284e213'),
('/images/legacy-ads/reconciled/647.jpg','647','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','071cdf684f38aba83bdb0c9e75ee878bfc3f882f13367eeab24f81d00324ca41'),
('/images/legacy-ads/reconciled/70.jpg','70','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','7dacf395d083864fdea3520a1fadc71df87188bc823e10a0874851425284e213'),
('/images/legacy-ads/rodelpark-oderwitz.jpg','rodelpark oderwitz','Vorhandenes Legacy-Werbeoriginal; keine automatische Profilzuordnung','de56e62e7db7a4260f5fc9ad0983c9073320e4e1938ddb9f52dff3529eb7d463')
), registered AS (
 INSERT INTO public.media_library_assets(bucket_id,storage_path,kind,name,alt_text,source,sha256)
 SELECT 'project-media',path,'banner',left(name,200),left(name,500),source,hash FROM originals
 ON CONFLICT(bucket_id,storage_path) DO NOTHING RETURNING id,storage_path
)
INSERT INTO public.media_library_files(bucket_id,storage_path,asset_id,context_key)
 SELECT 'project-media',storage_path,id,'original' FROM registered ON CONFLICT DO NOTHING;

-- Company-scoped library includes referenced banner originals without mutating catalog ownership.
CREATE OR REPLACE FUNCTION public.media_library_page(p_profile uuid DEFAULT NULL,p_kind text DEFAULT '',p_query text DEFAULT '',p_page integer DEFAULT 1,p_archived boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE items jsonb; total integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 IF p_page<1 OR p_page>100000 OR char_length(p_query)>200 OR p_kind NOT IN ('','gallery','logo','contact','block','banner','unused') THEN RAISE EXCEPTION 'invalid catalog query'; END IF;
 WITH matches AS (SELECT a.*,p.display_name profile_name FROM public.media_library_assets a LEFT JOIN public.company_profiles p ON p.id=a.profile_id
 WHERE (p_profile IS NULL OR a.profile_id=p_profile OR EXISTS(SELECT 1 FROM public.media_library_files context_file WHERE context_file.asset_id=a.id AND context_file.profile_id=p_profile) OR EXISTS(SELECT 1 FROM public.company_ad_campaigns campaign JOIN public.media_library_files banner_file ON banner_file.bucket_id='ad-media' AND banner_file.storage_path=campaign.image_path WHERE banner_file.asset_id=a.id AND campaign.profile_id=p_profile)) AND ((a.archived_at IS NOT NULL)=p_archived)
 AND a.deleted_at IS NULL AND (p_archived OR a.deletion_requested_at IS NULL) AND (a.deletion_requested_at IS NOT NULL OR a.bucket_id='project-media' OR EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=a.bucket_id AND o.name=a.storage_path) OR EXISTS(SELECT 1 FROM public.media_library_files f JOIN storage.objects o ON o.bucket_id=f.bucket_id AND o.name=f.storage_path WHERE f.asset_id=a.id)) AND (p_kind IN ('','unused') OR a.kind=p_kind)
 AND (p_query='' OR concat_ws(' ',a.name,a.description,a.alt_text,p.display_name) ILIKE '%'||p_query||'%')
 AND (p_kind<>'unused' OR NOT EXISTS(SELECT 1 FROM public.media_library_files f WHERE f.asset_id=a.id AND jsonb_array_length(public.media_library_asset_references(f.bucket_id,f.storage_path))>0)))
 SELECT count(*) INTO total FROM matches;
 SELECT coalesce(jsonb_agg(item),'[]'::jsonb) INTO items FROM (
 SELECT to_jsonb(a)||jsonb_build_object('profile_name',p.display_name,'preview_file',(SELECT jsonb_build_object('bucket',f.bucket_id,'path',f.storage_path) FROM public.media_library_files f WHERE f.asset_id=a.id AND (f.bucket_id='project-media' OR EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=f.bucket_id AND o.name=f.storage_path)) ORDER BY (f.context_key='original') DESC,f.storage_path LIMIT 1),'usages',coalesce((SELECT jsonb_agg(u) FROM public.media_library_files f CROSS JOIN LATERAL jsonb_array_elements(public.media_library_asset_references(f.bucket_id,f.storage_path)) u WHERE f.asset_id=a.id),'[]'::jsonb)) item
 FROM public.media_library_assets a LEFT JOIN public.company_profiles p ON p.id=a.profile_id
 WHERE (p_profile IS NULL OR a.profile_id=p_profile OR EXISTS(SELECT 1 FROM public.media_library_files context_file WHERE context_file.asset_id=a.id AND context_file.profile_id=p_profile) OR EXISTS(SELECT 1 FROM public.company_ad_campaigns campaign JOIN public.media_library_files banner_file ON banner_file.bucket_id='ad-media' AND banner_file.storage_path=campaign.image_path WHERE banner_file.asset_id=a.id AND campaign.profile_id=p_profile)) AND ((a.archived_at IS NOT NULL)=p_archived) AND a.deleted_at IS NULL AND (p_archived OR a.deletion_requested_at IS NULL) AND (a.deletion_requested_at IS NOT NULL OR a.bucket_id='project-media' OR EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=a.bucket_id AND o.name=a.storage_path) OR EXISTS(SELECT 1 FROM public.media_library_files f JOIN storage.objects o ON o.bucket_id=f.bucket_id AND o.name=f.storage_path WHERE f.asset_id=a.id))
 AND (p_kind IN ('','unused') OR a.kind=p_kind) AND (p_query='' OR concat_ws(' ',a.name,a.description,a.alt_text,p.display_name) ILIKE '%'||p_query||'%')
 AND (p_kind<>'unused' OR NOT EXISTS(SELECT 1 FROM public.media_library_files f WHERE f.asset_id=a.id AND jsonb_array_length(public.media_library_asset_references(f.bucket_id,f.storage_path))>0))
 ORDER BY a.created_at DESC,a.id LIMIT 24 OFFSET (p_page-1)*24) page;
 RETURN jsonb_build_object('items',items,'count',total);
END; $$;

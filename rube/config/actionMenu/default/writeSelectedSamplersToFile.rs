//Name: Write selected sampler output to file
//Tags: sampler

sampler[] s = getSelectedSamplers();
for (uint i = 0; i < s.length; i++)
	s[i].writeToFile();

import torch
import urllib.request
import io

url = 'https://download.pytorch.org/models/resnet50-19c8e357.pth'
path = './tmp.pth'
urllib.request.urlretrieve(url, path)

torch.save(torch.load(path), path)


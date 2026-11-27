// Rasterizes a subdivided texture mesh for the combat sprites.
#include <algorithm>
#include <cmath>

struct Point { float x, y, u, v; };
static float cross(float x, float y, float a, float b) { return x*b-y*a; }

static void triangle(const Point a, const Point b, const Point c,
                     const float* rgba, float* output, int w, int h) {
    const float dux=b.x-a.x, duy=b.y-a.y, dvx=c.x-a.x, dvy=c.y-a.y;
    const float area=cross(dux,duy,dvx,dvy);
    if(std::abs(area)<.025f) return;
    const int left=std::max(0,int(std::ceil(std::min({a.x,b.x,c.x}))));
    const int right=std::min(w-1,int(std::floor(std::max({a.x,b.x,c.x}))));
    const int top=std::max(0,int(std::ceil(std::min({a.y,b.y,c.y}))));
    const int bottom=std::min(h-1,int(std::floor(std::max({a.y,b.y,c.y}))));
    for(int y=top; y<=bottom; ++y) for(int x=left; x<=right; ++x) {
        const float B=cross(x-a.x,y-a.y,dvx,dvy)/area;
        const float C=cross(dux,duy,x-a.x,y-a.y)/area;
        const float A=1-B-C;
        if(std::min({A,B,C})<-.0001f) continue;
        const float sx=std::clamp(A*a.u+B*b.u+C*c.u,0.f,w-1.001f);
        const float sy=std::clamp(A*a.v+B*b.v+C*c.v,0.f,h-1.001f);
        const int ix=int(sx), iy=int(sy);
        const float X=sx-ix,Y=sy-iy;
        const float* s=rgba+4*(iy*w+ix);
        auto sample=[&](int i){
            return (s[i]*(1-X)+s[i+4]*X)*(1-Y)
                +(s[4*w+i]*(1-X)+s[4*w+i+4]*X)*Y;
        };
        float* dst=output+4*(y*w+x);
        const float alpha=sample(3);
        if(alpha<=dst[3]) continue;
        for(int i=0;i<3;++i) dst[i]=sample(i);
        dst[3]=alpha;
    }
}

extern "C" void rasterize(const float* rgba, const float* x, const float* y,
                          float* output, int w, int h) {
    auto vert=[&](int u,int v){return Point{x[v*w+u],y[v*w+u],float(u),float(v)};};
    constexpr int step=3;
    for(int v=0;v<h-1;v+=step) for(int u=0;u<w-1;u+=step) {
        const int r=std::min(u+step,w-1),b=std::min(v+step,h-1);
        const Point a=vert(u,v),c=vert(u,b),d=vert(r,b),e=vert(r,v);
        triangle(a,e,c,rgba,output,w,h);
        triangle(c,e,d,rgba,output,w,h);
    }
}
